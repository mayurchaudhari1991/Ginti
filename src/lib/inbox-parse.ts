import type { InboxMessage } from '@/modules/ginti-inbox';
import { guessCategory } from '@/lib/ollama';
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

const AMOUNT = /(?:rs\.?|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT = /\b(debited|spent|paid|sent|withdrawn|purchase|transferred to|txn of)\b/i;
const CREDIT = /\b(credited|received|deposited|refund(?:ed)?)\b/i;
// Bills, reminders, OTPs and offers mention amounts but are not money that moved.
const SKIP = /\b(otp|one time password|verification code|will be (?:debited|credited)|is due|due on|due date|requested|request of|collect request|reminder|offer|cashback of upto|win |apply now|pre-approved|loan of|bill (?:generated|of)|statement|failed|declined|unsuccessful|reversed|minimum amount)\b/i;
const ATM = /\b(atm|cash withdrawal|withdrawn at)\b/i;

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
  const patterns =
    kind === 'income'
      ? [/(?:from|by)\s+(?:vpa\s+)?([a-z0-9@._&' -]{2,40}?)(?=\s+(?:on|ref|upi|via|to|avl|info)\b|[.,(]|$)/i]
      : [
          /(?:to|at|towards|for)\s+(?:vpa\s+)?([a-z0-9@._&' -]{2,40}?)(?=\s+(?:on|ref|upi|via|using|from|avl|info|bal)\b|[.,(]|$)/i,
          /info:?\s*([a-z0-9@._ -]{2,40})/i,
        ];
  for (const p of patterns) {
    const m = body.match(p);
    if (!m) continue;
    let name = m[1].trim();
    if (name.includes('@')) name = name.split('@')[0].replace(/[._-]?\d+$/, '').replace(/[._-]/g, ' ');
    if (/^(your|a\/c|ac|account|card|x+\d*|\d+)$/i.test(name)) continue;
    return titleCase(name);
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
  const amountMatch = body.match(AMOUNT);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!(amount > 0)) return null;

  // "Credit card" is a product, not a direction.
  const verbs = body.replace(/credit card/gi, 'card');
  const d = verbIndex(verbs, DEBIT);
  const c = verbIndex(verbs, CREDIT);
  if (d === Infinity && c === Infinity) return null;
  const isAtm = ATM.test(body);
  let kind: TxnKind = isAtm ? 'transfer' : d <= c ? 'expense' : 'income';

  const last4 = last4Of(body);
  const bank = BANKS.find(([re]) => re.test(msg.address) || re.test(body))?.[1];
  const live = accounts.filter((a) => !a.archived);
  const account =
    (last4 && live.find((a) => a.last4 === last4)) ||
    (bank && live.find((a) => a.kind !== 'cash' && a.name.toLowerCase().includes(bank))) ||
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
