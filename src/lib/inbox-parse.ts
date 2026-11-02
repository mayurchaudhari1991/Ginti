import type { InboxMessage } from '@/modules/ginti-inbox';
import { guessCategory } from '@/lib/categorize';
import type { Account, Category, TxnKind } from '@/lib/types';

/** A money movement found in an SMS or notification, waiting for the user to approve it. */
export type Detected = {
  ref: string;
  time: number;
  source: 'sms' | 'notification';
  kind: TxnKind;
  amount: number;
  merchant: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  raw: string;
  /** Looks like something already in the ledger; unticked by default. */
  maybeDuplicate?: boolean;
};

// "Rs.450", "Rs 450", "Rs:450" (Union Bank), "INR 450", "₹450".
const AMOUNT = /(?:rs\.?|inr|₹)\s?:?\s?([\d,]+(?:\.\d{1,2})?)/i;
// SBI and some others write "debited by 1284.0" with no currency marker; trusted only from bank senders.
const VERB_AMOUNT = /\b(?:debited|credited|withdrawn|spent|paid|sent)\s+(?:by|for|of|with)?\s*([\d,]+(?:\.\d{1,2})?)\b/i;
const DEBIT = /\b(debited|spent|paid|sent|withdrawn|purchase|transferred to|txn of)\b/i;
const CREDIT = /\b(credited|received|deposited|refund(?:ed)?)\b/i;
// Bills, reminders, OTPs and offers mention amounts but are not money that moved.
// Fund-house notices (folio, NAV, units) repeat a debit the bank already reported.
const SKIP = /\b(otp|one time password|verification code|will be (?:debited|credited)|is due|due on|due date|requested|request of|collect request|reminder|offer|cashback of upto|win |apply now|pre-approved|loan of|bill (?:generated|of)|statement|failed|declined|unsuccessful|unfortunately|insufficient|reversed|minimum amount|lien|mandate|folio|investor|units allotted|nav of)\b/i;
const ATM = /\b(atm|cash withdrawal|withdrawn at)\b/i;
// A biller confirming it was paid ("Recharge of INR 199 is successful", "receipt of Rs.999 towards ACT"): money went out.
const BILLER_PAID = /\b(recharge of .{0,40}\b(?:successful|done)|payment of .{0,60}\b(?:received|successful)|receipt of (?:rs|inr|₹))/i;
// Words that look like a payee but are just the rail or a reference.
const NOT_A_PAYEE = /^(upi|neft|imps|rtgs|mob bk|net ?banking|ref.*|inr.*|rs.*|₹.*|\d.*|your|a\/c|ac|account|card|x+\d*|(?:receipt|payment|recharge|purchase|txn|transaction|amount)\b.*)$/i;

const BANKS: [RegExp, string][] = [
  [/hdfc/i, 'hdfc'],
  [/sbi(?:inb|upi|psg|bnk)?|state bank/i, 'sbi'],
  [/icici/i, 'icici'],
  [/axis/i, 'axis'],
  [/kotak/i, 'kotak'],
  [/\bpnb|punjab national/i, 'pnb'],
  [/\bbob|baroda/i, 'baroda'],
  [/idfc/i, 'idfc'],
  [/\byes ?bank|yesbnk/i, 'yes'],
  [/indus/i, 'indusind'],
  [/canara|canbnk/i, 'canara'],
  [/union bank|unionb/i, 'union'],
  [/bank of india|boiind|\bboi\b/i, 'boi'],
  [/federal|fedbnk/i, 'federal'],
  [/jupiter|onjptr/i, 'jupiter'],
  [/idbi/i, 'idbi'],
  [/\bau ?bank|aubank/i, 'au'],
];

const APP_NAMES: Record<string, string> = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'in.org.npci.upiapp': 'BHIM',
  'in.amazon.mShop.android.shopping': 'Amazon Pay',
  'com.dreamplug.androidapp': 'CRED',
};

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pulls a readable payee out of "to VPA swiggy@icici", "at FRESH MART", "UPI/P2M/1234/ZOMATO" and similar. */
function merchantOf(body: string, kind: TxnKind) {
  const upi = body.match(/upi\/(?:p2[am]\/)?\d*\/?([a-z][a-z0-9 .&'-]{2,30})/i);
  if (upi) return titleCase(upi[1]);
  const stop = '(?=\\s+(?:on|ref|refno|upi|via|using|from|to|avl|info|bal|txn|imps|neft|a\\/c|with)\\b|[.,(;]|$)';
  const patterns =
    kind === 'income'
      ? [new RegExp(`\\b(?:from|by)\\s+(?:vpa\\s+)?([a-z0-9@._&' -]{2,40}?)${stop}`, 'gi')]
      : [
          /\bfvg:?\s*([a-z0-9 .&'-]{2,30}?)(?=\s*$|[.,;])/gi, // Union Bank: "Fvg: GOOGLE"
          new RegExp(`\\b(?:to|at|towards|for)\\s+(?:vpa\\s+)?([a-z0-9@._&' -]{2,40}?)${stop}`, 'gi'),
          /\binfo:?\s*([a-z0-9@._ -]{2,40})/gi,
        ];
  // Every candidate is tried in order: "confirmation for receipt of Rs.999 towards ACT" skips "receipt of Rs".
  for (const p of patterns) {
    for (const m of body.matchAll(p)) {
      let name = m[1].trim().replace(/^(your|the|a)\s+/i, '');
      if (name.includes('@')) name = name.split('@')[0].replace(/[._-]?\d+$/, '').replace(/[._-]/g, ' ');
      if (NOT_A_PAYEE.test(name.trim())) continue;
      return titleCase(name);
    }
  }
  return '';
}

function last4Of(body: string) {
  return (
    body.match(/(?:a\/c|acct|account|card|ac)\s*(?:no\.?)?\s*(?:ending\s*(?:with)?\s*)?[x*.\- ]*(\d{4})\b/i)?.[1] ??
    body.match(/[x*]{2,}(\d{3,4})\b/i)?.[1] ??
    null
  );
}

function verbIndex(body: string, re: RegExp) {
  const m = body.match(re);
  return m?.index ?? Infinity;
}

/** Parses one message; null when it isn't a completed money movement. */
export function parseMessage(msg: InboxMessage, source: Detected['source'], accounts: Account[], categories: Category[]): Detected | null {
  const body = msg.body.replace(/\s+/g, ' ').trim();
  // Texts from personal numbers are conversations, not bank alerts.
  if (source === 'sms' && /^\+?\d{8,}$/.test(msg.address.replace(/\s/g, ''))) return null;
  if (SKIP.test(body)) return null;
  const fromBank = BANKS.some(([re]) => re.test(msg.address));
  const amountMatch = body.match(AMOUNT) ?? (fromBank ? body.match(VERB_AMOUNT) : null);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!(amount > 0)) return null;

  // "Credit card" is a product, not a direction.
  const verbs = body.replace(/credit card/gi, 'card');
  const d = verbIndex(verbs, DEBIT);
  const c = verbIndex(verbs, CREDIT);
  const billerPaid = BILLER_PAID.test(body);
  if (d === Infinity && c === Infinity && !billerPaid) return null;
  const isAtm = ATM.test(body);
  let kind: TxnKind = isAtm ? 'transfer' : billerPaid || d <= c ? 'expense' : 'income';
  // Only banks tell you money came in; a shop or biller saying "received" means it received yours.
  if (kind === 'income' && source === 'sms' && !fromBank) kind = 'expense';

  const last4 = last4Of(body);
  const bankRe = BANKS.find(([re]) => re.test(msg.address) || re.test(body))?.[0];
  const live = accounts.filter((a) => !a.archived);
  const banks = live.filter((a) => a.kind !== 'cash');
  const account =
    (last4 && live.find((a) => a.last4 === last4)) ||
    // The same pattern that recognised the sender recognises the account name ("BOIIND" ↔ "Bank of India").
    (bankRe && banks.find((a) => bankRe.test(a.name))) ||
    // One bank account: an SMS from a bank or payment app can only be about that one.
    (source === 'sms' && banks.length === 1 ? banks[0] : null) ||
    null;
  const cash = live.find((a) => a.kind === 'cash') ?? null;
  if (kind === 'transfer' && !cash) kind = 'expense';

  const appName = APP_NAMES[msg.address];
  const merchant = isAtm ? 'ATM withdrawal' : merchantOf(body, kind) || appName || '';

  return {
    ref: msg.id,
    time: msg.time,
    source,
    kind,
    amount,
    merchant,
    accountId: account?.id ?? null,
    toAccountId: kind === 'transfer' ? (cash?.id ?? null) : null,
    categoryId: kind === 'transfer' ? null : guessCategory(`${merchant} ${body}`, kind === 'income' ? 'income' : 'expense', categories),
    raw: body,
  };
}

/**
 * Collapses the same payment seen twice (the bank SMS and the Google Pay notification arrive minutes
 * apart). The SMS wins because it names the account.
 */
export function dedupe(items: Detected[]) {
  const sorted = [...items].sort((a, b) => (a.source === b.source ? a.time - b.time : a.source === 'sms' ? -1 : 1));
  const kept: Detected[] = [];
  for (const it of sorted) {
    const twin = kept.find((k) => k.amount === it.amount && k.kind === it.kind && Math.abs(k.time - it.time) < 15 * 60 * 1000);
    if (twin) {
      if (!twin.merchant && it.merchant) twin.merchant = it.merchant;
      continue;
    }
    kept.push(it);
  }
  return kept.sort((a, b) => b.time - a.time);
}
