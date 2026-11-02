import type { NewRecurring, Recurring, Txn } from '@/lib/types';

/** This month's due date, clamped for short months (a "31st" bill is due on 30 April). */
export function dueDate(r: Recurring, year: number, month: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(r.day_of_month, last));
}

/** Ledger key for one bill in one month, so paying twice is impossible. */
export const paymentRef = (r: Recurring, year: number, month: number) => `rec:${r.id}:${year}-${String(month + 1).padStart(2, '0')}`;

export function isPaid(r: Recurring, txns: Txn[], year: number, month: number) {
  const name = r.name.toLowerCase();
  return txns.some((t) => {
    const d = new Date(t.occurred_at);
    return t.source === 'recurring' && t.note?.toLowerCase() === name && d.getFullYear() === year && d.getMonth() === month;
  });
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Payments that look like subscriptions: the same payee in at least two of the last four months for
 * roughly the same amount, and not tracked yet.
 */
export function suggestRecurring(txns: Txn[], tracked: Recurring[], now = new Date()): NewRecurring[] {
  const since = new Date(now.getFullYear(), now.getMonth() - 4, 1).getTime();
  const trackedNames = new Set(tracked.map((r) => normalise(r.name)));
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.kind !== 'expense' || !t.note || new Date(t.occurred_at).getTime() < since) continue;
    const key = normalise(t.note);
    if (key.length < 3 || trackedNames.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: NewRecurring[] = [];
  for (const list of groups.values()) {
    const months = new Set(list.map((t) => t.occurred_at.slice(0, 7)));
    if (months.size < 2) continue;
    const amounts = list.map((t) => t.amount);
    if (Math.max(...amounts) / Math.min(...amounts) > 1.15) continue;
    const latest = list[0];
    out.push({
      name: latest.note!,
      amount: latest.amount,
      account_id: latest.account_id,
      category_id: latest.category_id,
      day_of_month: new Date(latest.occurred_at).getDate(),
    });
  }
  return out.slice(0, 3);
}
