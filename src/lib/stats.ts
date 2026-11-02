import { inr, monthName } from '@/lib/format';
import type { Account, Category, Txn } from '@/lib/types';

export type Range = { start: Date; end: Date };

export function monthRange(year: number, month: number): Range {
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

export function yearRange(year: number): Range {
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

export function previousMonth(year: number, month: number) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

function inRange(t: Txn, r: Range) {
  const d = new Date(t.occurred_at).getTime();
  return d >= r.start.getTime() && d < r.end.getTime();
}

/** Expenses in a range, optionally limited to some accounts. */
export function expenses(txns: Txn[], r: Range, accountIds?: string[]) {
  return txns.filter((t) => t.kind === 'expense' && inRange(t, r) && (!accountIds || accountIds.includes(t.account_id)));
}

export const sum = (txns: Txn[]) => txns.reduce((s, t) => s + t.amount, 0);

export type CategoryStat = { category: Category | null; total: number; previous: number; share: number };

export function byCategory(txns: Txn[], categories: Category[], r: Range, prev: Range, accountIds?: string[]): CategoryStat[] {
  const now = expenses(txns, r, accountIds);
  const before = expenses(txns, prev, accountIds);
  const total = sum(now) || 1;
  const totals = new Map<string | null, { total: number; previous: number }>();
  for (const t of now) {
    const e = totals.get(t.category_id) ?? { total: 0, previous: 0 };
    e.total += t.amount;
    totals.set(t.category_id, e);
  }
  for (const t of before) {
    const e = totals.get(t.category_id);
    if (e) e.previous += t.amount;
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  return [...totals.entries()]
    .map(([id, v]) => ({ category: id ? (byId.get(id) ?? null) : null, total: v.total, previous: v.previous, share: v.total / total }))
    .sort((a, b) => b.total - a.total);
}

export type AccountStat = { account: Account; total: number; share: number; count: number };

export function byAccount(txns: Txn[], accounts: Account[], r: Range): AccountStat[] {
  const now = expenses(txns, r);
  const total = sum(now) || 1;
  return accounts
    .map((account) => {
      const mine = now.filter((t) => t.account_id === account.id);
      const s = sum(mine);
      return { account, total: s, share: s / total, count: mine.length };
    })
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Twelve monthly expense totals for a year. */
export function byMonth(txns: Txn[], year: number, accountIds?: string[]) {
  const out = new Array(12).fill(0) as number[];
  for (const t of expenses(txns, yearRange(year), accountIds)) out[new Date(t.occurred_at).getMonth()] += t.amount;
  return out;
}

/** Spend per day of a month, for the calendar heat map. */
export function byDay(txns: Txn[], year: number, month: number) {
  const days = new Date(year, month + 1, 0).getDate();
  const out = new Array(days).fill(0) as number[];
  for (const t of expenses(txns, monthRange(year, month))) out[new Date(t.occurred_at).getDate() - 1] += t.amount;
  return out;
}

/**
 * A compact plain-text digest of the ledger for the local model. Small models cannot query the database,
 * so we hand them the numbers they need instead.
 */
export function ledgerDigest(txns: Txn[], accounts: Account[], categories: Category[], now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const p = previousMonth(y, m);
  const lines: string[] = [];
  lines.push(`Today is ${now.toDateString()}. Currency is Indian rupees.`);
  lines.push('Accounts and balances: ' + accounts.map((a) => `${a.name} (${a.kind}) ${inr(a.balance)}`).join('; '));
  const thisMonth = byCategory(txns, categories, monthRange(y, m), monthRange(p.year, p.month));
  lines.push(
    `${monthName(m)} ${y} spending by category: ` +
      (thisMonth.map((c) => `${c.category?.name ?? 'Uncategorised'} ${inr(c.total)} (last month ${inr(c.previous)})`).join('; ') || 'nothing yet'),
  );
  lines.push(`${monthName(m)} spending by account: ` + (byAccount(txns, accounts, monthRange(y, m)).map((a) => `${a.account.name} ${inr(a.total)}`).join('; ') || 'nothing yet'));
  const months = byMonth(txns, y);
  lines.push(`${y} monthly totals: ` + months.slice(0, m + 1).map((v, i) => `${monthName(i)} ${inr(v)}`).join(', '));
  const yearCats = byCategory(txns, categories, yearRange(y), yearRange(y - 1));
  lines.push(`${y} by category: ` + yearCats.map((c) => `${c.category?.name ?? 'Uncategorised'} ${inr(c.total)}`).join('; '));
  for (const a of accounts) {
    const cats = byCategory(txns, categories, yearRange(y), yearRange(y - 1), [a.id]);
    if (cats.length) lines.push(`${y} via ${a.name}: ` + cats.map((c) => `${c.category?.name ?? 'Uncategorised'} ${inr(c.total)}`).join('; '));
  }
  const recent = txns.slice(0, 25).map((t) => {
    const cat = categories.find((c) => c.id === t.category_id)?.name ?? t.kind;
    const acc = accounts.find((a) => a.id === t.account_id)?.name ?? '';
    return `${t.occurred_at.slice(0, 10)} ${cat} ${inr(t.amount)} via ${acc}${t.note ? ` "${t.note}"` : ''}`;
  });
  lines.push('Most recent entries: ' + recent.join('; '));
  return lines.join('\n');
}
