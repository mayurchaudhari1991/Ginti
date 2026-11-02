import { Alert, Pressable, View } from 'react-native';

import { Txt } from '@/components/txt';
import { CategoryBadge, tap } from '@/components/ui';
import { inr, timeLabel } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import type { Txn } from '@/lib/types';
import { C } from '@/theme/tokens';

/** One ledger entry. Long-press offers delete. */
export function TxnRow({ txn }: { txn: Txn }) {
  const { categories, accounts, deleteTxn } = useLedger();
  const cat = categories.find((c) => c.id === txn.category_id);
  const acc = accounts.find((a) => a.id === txn.account_id);
  const to = accounts.find((a) => a.id === txn.to_account_id);

  const title = txn.note || cat?.name || (txn.kind === 'transfer' ? `To ${to?.name ?? 'account'}` : 'Entry');
  const meta = `${(acc?.name ?? '').toUpperCase()} · ${timeLabel(txn.occurred_at)}`;
  const color = txn.kind === 'transfer' ? C.ion : (cat?.color ?? C.muted);
  const amount = txn.kind === 'income' ? inr(txn.amount, { sign: true }) : txn.kind === 'expense' ? inr(-txn.amount) : inr(txn.amount);

  return (
    <Pressable
      onLongPress={() => {
        tap();
        Alert.alert('Delete entry?', `${title} · ${inr(txn.amount)}`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteTxn(txn.id).catch((e) => Alert.alert('Could not delete', String(e.message ?? e))) },
        ]);
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
