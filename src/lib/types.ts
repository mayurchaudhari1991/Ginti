export type AccountKind = 'bank' | 'cash' | 'credit' | 'wallet';
export type TxnKind = 'expense' | 'income' | 'transfer';
export type TxnSource = 'manual' | 'ai' | 'receipt' | 'recurring' | 'sms' | 'notification';

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  last4: string | null;
  color: string;
  opening_balance: number;
  archived: boolean;
  balance: number;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  kind: TxnKind;
  monthly_budget: number | null;
  sort: number;
};

export type Txn = {
  id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  kind: TxnKind;
  amount: number;
  note: string | null;
  occurred_at: string;
  source: TxnSource;
  external_ref?: string | null;
};

export type NewTxn = Omit<Txn, 'id' | 'source'> & { source?: TxnSource; external_ref?: string };
export type NewAccount = Pick<Account, 'name' | 'kind' | 'last4' | 'color' | 'opening_balance'>;
export type NewCategory = Pick<Category, 'name' | 'color' | 'icon' | 'kind'> & { monthly_budget?: number | null };

export type Recurring = {
  id: string;
  name: string;
  amount: number;
  account_id: string | null;
  category_id: string | null;
  day_of_month: number;
  active: boolean;
};

export type NewRecurring = Omit<Recurring, 'id' | 'active'>;
