// Run: npx tsx scripts/check-device-sms.ts
// Pulls recent SMS from the USB-connected phone and reports how the parser handles bank-style ones.
// Prints counts and digit-masked snippets of unparsed money messages only; nothing is stored.
import { execFileSync } from 'node:child_process';

import { parseMessage } from '../src/lib/inbox-parse';
import type { Account, Category } from '../src/lib/types';

const adb = `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`;
const since = Date.now() - 60 * 86400000;
const serial = process.env.ADB_SERIAL ? ['-s', process.env.ADB_SERIAL] : [];
const raw = execFileSync(adb, [...serial, 'shell', 'content', 'query', '--uri', 'content://sms/inbox', '--projection', 'address:date:body', '--where', `"date>${since}"`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const rows = raw
  .split(/\r?\nRow: \d+ /)
  .map((r) => r.replace(/^Row: \d+ /, ''))
  .map((r) => {
    const m = r.match(/^address=(.*?), date=(\d+), body=([\s\S]*)$/);
    return m ? { id: `sms:${m[2]}`, address: m[1], time: Number(m[2]), body: m[3].trim() } : null;
  })
  .filter((r): r is NonNullable<typeof r> => r != null);

const accounts: Account[] = [
  { id: 'cash', name: 'Cash wallet', kind: 'cash', last4: null, color: '', opening_balance: 0, archived: false, balance: 0 },
];
const categories: Category[] = ['Other', 'Other income'].map((name, i) => ({ id: name, name, color: '', icon: 'dot', kind: i ? 'income' : 'expense', monthly_budget: null, sort: i }));

const business = rows.filter((r) => !/^\+?\d{8,}$/.test(r.address.replace(/\s/g, '')));
const money = business.filter((r) => /(rs\.?|inr|₹)\s?[\d,]+|debited|credited/i.test(r.body));
const parsed = money.map((r) => ({ r, d: parseMessage(r, 'sms', accounts, categories) }));
const ok = parsed.filter((p) => p.d);
const mask = (s: string) => s.replace(/\d/g, '9').replace(/[\w.-]+@[\w.-]+/g, '<vpa>').slice(0, 110);

console.log(`inbox messages (60 days): ${rows.length}`);
console.log(`from business senders:    ${business.length}`);
console.log(`mention money:            ${money.length}`);
console.log(`parsed as transactions:   ${ok.length}  (${['expense', 'income', 'transfer'].map((k) => `${k} ${ok.filter((p) => p.d!.kind === k).length}`).join(', ')})`);
console.log(`with merchant found:      ${ok.filter((p) => p.d!.merchant).length}`);
console.log('\nsenders of parsed:', [...new Set(ok.map((p) => p.r.address.replace(/^[A-Z]{2}-/, '').replace(/-[A-Z]$/, '')))].join(', '));
console.log('\nparsed, per sender (digits masked):');
const bySender = new Map<string, typeof ok>();
for (const p of ok) {
  const s = p.r.address.replace(/^[A-Z]{2}-/, '').replace(/-[A-Z]$/, '');
  bySender.set(s, [...(bySender.get(s) ?? []), p]);
}
for (const [s, list] of bySender) {
  console.log(`  ${s}: ${list.length} (${['expense', 'income', 'transfer'].map((k) => `${k[0]}${list.filter((p) => p.d!.kind === k).length}`).join(' ')})`);
  for (const p of list.slice(0, 2)) console.log(`     ${p.d!.kind} ${p.d!.amount} "${p.d!.merchant}" <- ${mask(p.r.body).slice(0, 90)}`);
}

console.log('\nunparsed money messages (digits masked):');
for (const p of parsed.filter((x) => !x.d).slice(0, 25)) console.log(`  [${p.r.address}] ${mask(p.r.body)}`);
