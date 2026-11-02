import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { choose, confirm, notify } from '@/components/dialog';
import { Txt } from '@/components/txt';
import { CategoryBadge, tap } from '@/components/ui';
import { inr, timeLabel } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import type { Txn } from '@/lib/types';
import { C } from '@/theme/tokens';

/** One ledger entry. Tap to edit; long-press for edit or delete. */
export function TxnRow({ txn }: { txn: Txn }) {
  const { categories, accounts, deleteTxn } = useLedger();
  const cat = categories.find((c) => c.id === txn.category_id);
  const acc = accounts.find((a) => a.id === txn.account_id);
  const to = accounts.find((a) => a.id === txn.to_account_id);

  const title = txn.note || cat?.name || (txn.kind === 'transfer' ? `To ${to?.name ?? 'account'}` : 'Entry');
  const meta = `${(acc?.name ?? '').toUpperCase()} · ${timeLabel(txn.occurred_at)}`;
  const color = txn.kind === 'transfer' ? C.ion : (cat?.color ?? C.muted);
  const amount = txn.kind === 'income' ? inr(txn.amount, { sign: true }) : txn.kind === 'expense' ? inr(-txn.amount) : inr(txn.amount);

  const edit = () => router.push({ pathname: '/add', params: { id: txn.id } });

  async function remove() {
    if (!(await confirm({ title: 'Delete entry?', message: `${title} · ${inr(txn.amount)}`, confirm: 'Delete', destructive: true }))) return;
    deleteTxn(txn.id).catch((e) => notify('Could not delete', e instanceof Error ? e.message : String(e)));
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the entry to edit"
      onPress={() => {
        tap();
        edit();
      }}
      onLongPress={async () => {
        tap();
        const when = new Date(txn.occurred_at);
        const action = await choose(title, `${inr(txn.amount)} · ${acc?.name ?? 'Account'} · ${when.toDateString().slice(4, 10)}, ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`, [
          { label: 'Edit entry', value: 'edit', icon: 'settings', tone: 'plain' },
          { label: 'Delete entry', value: 'delete', icon: 'trash', tone: 'danger' },
          { label: 'Cancel', value: 'cancel', tone: 'cancel' },
        ]);
        if (action === 'edit') edit();
        if (action === 'delete') remove();
      }}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}>
      <CategoryBadge color={color} icon={txn.kind === 'transfer' ? 'cash' : (cat?.icon ?? 'dot')} />
      <View style={{ flex: 1 }}>
        <Txt variant="medium" numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="mono" style={{ marginTop: 2 }}>
          {meta}
        </Txt>
      </View>
      <Txt variant="strong" color={txn.kind === 'income' ? C.volt : C.text}>
        {amount}
      </Txt>
    </Pressable>
  );
}
