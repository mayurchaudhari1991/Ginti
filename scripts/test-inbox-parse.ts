// Run: npx tsx scripts/test-inbox-parse.ts
// Checks the SMS / notification parser against message formats Indian banks and UPI apps actually send.
import assert from 'node:assert/strict';

import { dedupe, parseMessage } from '../src/lib/inbox-parse';
import type { Account, Category } from '../src/lib/types';

const acc = (id: string, name: string, kind: Account['kind'], last4: string | null): Account => ({
  id,
  name,
  kind,
  last4,
  color: '#fff',
  opening_balance: 0,
  archived: false,
  balance: 0,
});
const accounts = [acc('cash', 'Cash wallet', 'cash', null), acc('hdfc', 'HDFC Bank', 'bank', '4821'), acc('sbi', 'SBI Salary', 'bank', '0932')];
const categories: Category[] = ['Food', 'Travel', 'Shopping', 'Bills', 'Other', 'Salary', 'Other income'].map((name, i) => ({
  id: name.toLowerCase().replace(' ', '-'),
  name,
  color: '#fff',
  icon: 'dot',
  kind: name === 'Salary' || name === 'Other income' ? 'income' : 'expense',
  monthly_budget: null,
  sort: i,
}));

const sms = (body: string, address = 'VM-HDFCBK') => parseMessage({ id: `sms:${body.length}`, address, body, time: Date.now() }, 'sms', accounts, categories);

const cases: [string, Parameters<typeof sms>, Partial<ReturnType<typeof sms> & object> | null][] = [
  [
    'HDFC UPI debit to a VPA',
    ['Sent Rs.450.00 From HDFC Bank A/C *4821 To SWIGGY On 02/11/26 Ref 630612345678 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808'],
    { kind: 'expense', amount: 450, accountId: 'hdfc', merchant: 'Swiggy', categoryId: 'food' },
  ],
  [
    'SBI debit by UPI',
    ['Dear UPI user A/C X0932 debited by 1284.0 on date 02Nov26 trf to FRESH MART Refno 430612345678. If not u? call 1800111109. -SBI', 'AD-SBIUPI'],
    { kind: 'expense', amount: 1284, accountId: 'sbi', merchant: 'Fresh Mart', categoryId: 'food' },
  ],
  ['Unknown sender without a currency marker is ignored', ['Your order of 3 items was debited by 1284 points', 'VM-SHOPPR']],
  [
    'Card spend',
    ['INR 1,284.00 spent on HDFC Bank Card x4821 at AMAZON PAY INDIA on 2026-11-02:18:05:11.Avl bal: INR 52,310.00'],
    { kind: 'expense', amount: 1284, accountId: 'hdfc', categoryId: 'shopping' },
  ],
  [
    'Salary credit',
    ['Your A/c XX0932 is credited with Rs 50,000.00 on 01-11-26 by NEFT from ACME PAYROLL SALARY. Avl Bal Rs 58,210.00', 'JD-SBIINB'],
    { kind: 'income', amount: 50000, accountId: 'sbi', categoryId: 'salary' },
  ],
  ['ATM withdrawal becomes a transfer to cash', ['Rs.5000.00 withdrawn at ATM S1AW000123 from A/c XX4821 on 02-11-26. Avl Bal Rs 47,310.00'], { kind: 'transfer', amount: 5000, accountId: 'hdfc', toAccountId: 'cash' }],
  ['OTP is ignored', ['OTP for txn of Rs 999.00 at FLIPKART on HDFC Bank Card x4821 is 482913. Valid for 5 mins.']],
  ['Bill reminder is ignored', ['Your Airtel bill of Rs 799 is due on 05-11-26. Pay now to avoid late fee.', 'VK-AIRTEL']],
  ['Credit card bill statement is ignored', ['Statement for HDFC Bank Credit Card x4821: Total due Rs 12,400.00, minimum amount Rs 620.00 due by 14-11-26.']],
  ['Personal number is ignored', ['Bhai Rs 500 sent to you, check', '+919876543210']],
  ['Collect request is ignored', ['Rs 300 collect request from 9876543210@ybl. Approve in your UPI app.']],
].map(([label, args, expected]) => [label as string, args as Parameters<typeof sms>, (expected ?? null) as never]);

let failed = 0;
for (const [label, args, expected] of cases) {
  const got = sms(...args);
  try {
    if (expected === null) assert.equal(got, null, 'expected no entry');
    else {
      assert.ok(got, 'expected an entry');
      for (const [k, v] of Object.entries(expected)) assert.equal((got as Record<string, unknown>)[k], v, `${k}`);
    }
    console.log(`  ok  ${label}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${label}: ${(e as Error).message}\n      got ${JSON.stringify(got)}`);
  }
}

// The bank SMS and the Google Pay notification for one payment collapse into one entry, keeping the SMS.
const t = Date.now();
const fromSms = sms('Sent Rs.450.00 From HDFC Bank A/C *4821 To SWIGGY On 02/11/26 Ref 630612345678')!;
const fromApp = parseMessage({ id: 'gpay:1', address: 'com.google.android.apps.nbu.paisa.user', body: '₹450 paid to Swiggy', time: t + 60_000 }, 'notification', accounts, categories)!;
const merged = dedupe([fromApp, fromSms]);
try {
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'sms');
  console.log('  ok  SMS and app notification merge');
} catch (e) {
  failed++;
  console.log(`FAIL  merge: ${(e as Error).message} ${JSON.stringify(merged)}`);
}

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
