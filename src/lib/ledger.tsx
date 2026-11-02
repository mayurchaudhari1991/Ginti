import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Account, Category, NewAccount, NewRecurring, NewTxn, Recurring, Txn } from '@/lib/types';

type Snapshot = { userId: string; accounts: Account[]; categories: Category[]; txns: Txn[]; recurring: Recurring[] };

type Ledger = {
  loading: boolean;
  error: string | null;
  accounts: Account[];
  categories: Category[];
  txns: Txn[];
  recurring: Recurring[];
  refresh: () => Promise<void>;
  addRecurring: (r: NewRecurring) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  addTxn: (t: NewTxn) => Promise<void>;
  /** Inserts auto-detected entries; ones already imported (same external_ref) are skipped. Returns how many were added. */
  importTxns: (list: NewTxn[]) => Promise<number>;
  deleteTxn: (id: string) => Promise<void>;
  addAccount: (a: NewAccount) => Promise<void>;
  setCategoryBudget: (id: string, budget: number | null) => Promise<void>;
};

const LedgerContext = createContext<Ledger | null>(null);

const PAGE = 1000;

/** History window: everything since 1 January of last year, so year-on-year views work. */
function sinceIso() {
  return new Date(new Date().getFullYear() - 1, 0, 1).toISOString();
}

async function fetchAllTxns(): Promise<Txn[]> {
  const out: Txn[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, account_id, to_account_id, category_id, kind, amount, note, occurred_at, source')
      .gte('occurred_at', sinceIso())
      .order('occurred_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data.map((t) => ({ ...t, amount: Number(t.amount) }) as Txn));
    if (data.length < PAGE) return out;
  }
}

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#FF8A4C', icon: 'food', kind: 'expense', sort: 1 },
  { name: 'Home', color: '#5B8CFF', icon: 'home', kind: 'expense', sort: 2 },
  { name: 'Shopping', color: '#FF5FA2', icon: 'bag', kind: 'expense', sort: 3 },
  { name: 'Travel', color: '#4CC9FF', icon: 'bus', kind: 'expense', sort: 4 },
  { name: 'Bills', color: '#FFD23F', icon: 'bolt', kind: 'expense', sort: 5 },
  { name: 'Health', color: '#3DDC97', icon: 'heart', kind: 'expense', sort: 6 },
  { name: 'Fun', color: '#9B8CFF', icon: 'game', kind: 'expense', sort: 7 },
  { name: 'Other', color: '#8A90A2', icon: 'dot', kind: 'expense', sort: 8 },
  { name: 'Salary', color: '#C8FF4D', icon: 'wallet', kind: 'income', sort: 1 },
  { name: 'Other income', color: '#3DDC97', icon: 'dot', kind: 'income', sort: 2 },
];

/** Mirrors the sign-up trigger, for accounts created before the schema existed. */
async function seedDefaults() {
  const { error: catError } = await supabase.from('categories').upsert(DEFAULT_CATEGORIES, { onConflict: 'user_id,name,kind', ignoreDuplicates: true });
  if (catError) throw catError;
  const { error: accError } = await supabase.from('accounts').insert({ name: 'Cash wallet', kind: 'cash', color: '#C8FF4D' });
  if (accError) throw accError;
}

async function fetchLedger(userId: string, seeded = false): Promise<Snapshot> {
  const [acc, bal, cat, rec, txns] = await Promise.all([
    supabase.from('accounts').select('id, name, kind, last4, color, opening_balance, archived').order('created_at'),
    supabase.from('account_balances').select('id, balance'),
    supabase.from('categories').select('id, name, color, icon, kind, monthly_budget, sort').order('sort'),
    supabase.from('recurring').select('id, name, amount, account_id, category_id, day_of_month, active').order('day_of_month'),
    fetchAllTxns(),
  ]);
  if (acc.error) throw acc.error;
  if (bal.error) throw bal.error;
  if (cat.error) throw cat.error;
  if (rec.error) throw rec.error;
  if (!seeded && acc.data.length === 0 && cat.data.length === 0) {
    await seedDefaults();
    return fetchLedger(userId, true);
  }
  const balances = new Map(bal.data.map((b) => [b.id, Number(b.balance)]));
  return {
    userId,
    accounts: acc.data.map((a) => ({ ...a, opening_balance: Number(a.opening_balance), balance: balances.get(a.id) ?? 0 }) as Account),
    categories: cat.data.map((c) => ({ ...c, monthly_budget: c.monthly_budget == null ? null : Number(c.monthly_budget) }) as Category),
    recurring: rec.data.map((r) => ({ ...r, amount: Number(r.amount) }) as Recurring),
    txns,
  };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchLedger(userId)
      .then((s) => {
        if (!alive) return;
        setSnapshot(s);
        setError(null);
      })
      .catch((e) => alive && setError(message(e)));
    return () => {
      alive = false;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setSnapshot(await fetchLedger(userId));
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, [userId]);

  // Data belongs to whoever is signed in now; a previous user's snapshot is never shown.
  const current = snapshot && snapshot.userId === userId ? snapshot : null;
  const patch = (fn: (s: Snapshot) => Snapshot) => setSnapshot((s) => (s ? fn(s) : s));

  const value: Ledger = {
    loading: !!userId && !current && !error,
    error,
    accounts: current?.accounts ?? [],
    categories: current?.categories ?? [],
    txns: current?.txns ?? [],
    recurring: current?.recurring ?? [],
    refresh,
    async addRecurring(r) {
      const { error } = await supabase.from('recurring').insert(r);
      if (error) throw error;
      await refresh();
    },
    async deleteRecurring(id) {
      const { error } = await supabase.from('recurring').delete().eq('id', id);
      if (error) throw error;
      patch((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== id) }));
    },
    async addTxn(t) {
      const { data, error } = await supabase.from('transactions').insert(t).select().single();
      if (error) throw error;
      patch((s) => ({ ...s, txns: [{ ...data, amount: Number(data.amount) } as Txn, ...s.txns] }));
      refresh();
    },
    async importTxns(list) {
      let added = 0;
      for (const t of list) {
        const { error } = await supabase.from('transactions').insert(t);
        if (!error) added += 1;
        else if (error.code !== '23505') throw error;
      }
      await refresh();
      return added;
    },
    async deleteTxn(id) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      patch((s) => ({ ...s, txns: s.txns.filter((t) => t.id !== id) }));
      refresh();
    },
    async addAccount(a) {
      const { error } = await supabase.from('accounts').insert(a);
      if (error) throw error;
      await refresh();
    },
    async setCategoryBudget(id, budget) {
      const { error } = await supabase.from('categories').update({ monthly_budget: budget }).eq('id', id);
      if (error) throw error;
      patch((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, monthly_budget: budget } : c)) }));
    },
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used inside LedgerProvider');
  return ctx;
}
