import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { choose, confirm, notify } from '@/components/dialog';
import { Icon } from '@/components/icon';
import { Pulse, Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Card, CategoryBadge, Empty, IconButton, Screen, tap } from '@/components/ui';
import { inr, timeLabel } from '@/lib/format';
import {
  inboxAvailable,
  inboxPermissions,
  openNotificationAccess,
  removePending,
  requestSmsPermission,
  scanInbox,
  updatePending,
  usePendingImports,
  type InboxPermissions,
} from '@/lib/inbox';
import type { Detected } from '@/lib/inbox-parse';
import { useLedger } from '@/lib/ledger';
import { C, F } from '@/theme/tokens';

export default function ImportScreen() {
  const { accounts, categories, txns, importTxns } = useLedger();
  const pending = usePendingImports();
  const [perms, setPerms] = useState<InboxPermissions>(() => inboxPermissions());
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set(pending.filter((p) => p.maybeDuplicate).map((p) => p.ref)));

  // Permissions change in system settings, so re-read them whenever we come back.
  useFocusEffect(
    useCallback(() => {
      setPerms(inboxPermissions());
      const sub = AppState.addEventListener('change', (s) => s === 'active' && setPerms(inboxPermissions()));
      return () => sub.remove();
    }, []),
  );

  async function scan(lookbackDays?: number) {
    setScanning(true);
    try {
      const n = await scanInbox(accounts, categories, txns, { lookbackDays });
      Haptics.notificationAsync(n ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (!n)
        notify(
          'All caught up',
          lookbackDays
            ? `No payments in the last ${lookbackDays} days that are not already in your ledger or waiting below.`
            : 'No new payments since the last scan. Use "Look back 60 days" to check older texts.',
        );
    } catch (e) {
      notify('Scan failed', e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  const selected = pending.filter((p) => !unchecked.has(p.ref) && p.accountId);

  async function importSelected() {
    setSaving(true);
    try {
      const added = await importTxns(
        selected.map((d) => ({
          kind: d.kind,
          amount: d.amount,
          account_id: d.accountId!,
          to_account_id: d.kind === 'transfer' ? d.toAccountId : null,
          category_id: d.kind === 'transfer' ? null : d.categoryId,
          note: d.merchant || null,
          occurred_at: new Date(d.time).toISOString(),
          source: d.source,
          external_ref: d.ref,
        })),
      );
      removePending(selected.map((d) => d.ref));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notify('Added', `${added} ${added === 1 ? 'entry' : 'entries'} added to your ledger.`);
    } catch (e) {
      notify('Could not import', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const toggle = (ref: string) => {
    tap();
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Txt variant="display" style={{ fontSize: 22 }}>
            Auto-import
          </Txt>
          <Txt variant="small">Bank SMS, Google Pay, PhonePe, Paytm</Txt>
        </View>
      </View>

      {!inboxAvailable ? (
        <Card tone="ai">
          <Txt color={C.ionTextSoft}>Auto-import needs the installed Ginti app. It does not run inside Expo Go.</Txt>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 12 }}>
            <PermissionRow
              icon="send"
              title="Bank SMS"
              body="Reads transaction texts from your bank. Covers UPI, cards, ATM and credits."
              granted={perms.sms}
              onPress={async () => {
                if (await requestSmsPermission()) {
                  setPerms(inboxPermissions());
                  // First access: pull in the last two months so the user sees results straight away.
                  scan(60);
                }
              }}
            />
            <View style={{ height: 1, backgroundColor: '#1A1D27' }} />
            <PermissionRow
              icon="bell"
              title="Payment app notifications"
              body="Catches Google Pay, PhonePe and Paytm payments. Turn on Ginti in the list that opens."
              granted={perms.notifications}
              onPress={openNotificationAccess}
            />
            <Txt variant="small" style={{ lineHeight: 17 }}>
              Messages are read on this phone only. Just the amount, payee and date go into your ledger, and only after you approve them.
            </Txt>
          </Card>

          <Button title={scanning ? 'Scanning…' : 'Scan for new payments'} icon="scan" onPress={() => scan()} busy={scanning} disabled={!perms.sms && !perms.notifications} />
          <Button title="Look back 60 days" variant="ghost" icon="calendar" onPress={() => scan(60)} disabled={scanning || !perms.sms} />
        </>
      )}

      {pending.length > 0 ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Txt variant="title" style={{ fontSize: 15, flex: 1 }}>
              Found {pending.length}
            </Txt>
            <Pressable
              hitSlop={10}
              style={{ marginRight: 16 }}
              onPress={() => setUnchecked(unchecked.size ? new Set() : new Set(pending.map((p) => p.ref)))}>
              <Txt style={{ fontSize: 13, color: C.volt }}>{unchecked.size ? 'Select all' : 'Select none'}</Txt>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (await confirm({ title: 'Dismiss all?', message: 'They will not be added to your ledger.', confirm: 'Dismiss', destructive: true }))
                  removePending(pending.map((p) => p.ref));
              }}
              hitSlop={10}>
              <Txt style={{ fontSize: 13, color: C.muted }}>Dismiss all</Txt>
            </Pressable>
          </View>
          {pending.map((d, i) => (
            <Rise key={d.ref} delay={Math.min(i, 10) * 50}>
              <DetectedRow item={d} checked={!unchecked.has(d.ref)} onToggle={() => toggle(d.ref)} />
            </Rise>
          ))}
          <Button title={`Add ${selected.length} to ledger`} icon="check" onPress={importSelected} busy={saving} disabled={selected.length === 0} />
        </View>
      ) : (
        inboxAvailable && <Empty icon="sync" title="Nothing waiting" body="New payments show up here after a scan. Ginti also scans each time you open it." />
      )}
    </Screen>
  );
}

function PermissionRow({ icon, title, body, granted, onPress }: { icon: 'send' | 'bell'; title: string; body: string; granted: boolean; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={[styles.permIcon, granted && { backgroundColor: C.voltBg }]}>
        <Icon name={granted ? 'check' : icon} size={18} color={granted ? C.volt : C.text2} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="strong">{title}</Txt>
        <Txt variant="small" style={{ marginTop: 2, lineHeight: 16 }}>
          {body}
        </Txt>
      </View>
      {granted ? (
        <Pulse>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.good }} />
        </Pulse>
      ) : (
        <Pressable onPress={onPress} style={styles.allow}>
          <Txt style={{ fontFamily: F.semibold, fontSize: 13, color: C.ink }}>Allow</Txt>
        </Pressable>
      )}
    </View>
  );
}

function DetectedRow({ item, checked, onToggle }: { item: Detected; checked: boolean; onToggle: () => void }) {
  const { accounts, categories } = useLedger();
  const cat = categories.find((c) => c.id === item.categoryId);
  const acc = accounts.find((a) => a.id === item.accountId);
  const color = item.kind === 'transfer' ? C.ion : item.kind === 'income' ? C.volt : (cat?.color ?? C.muted);
  const live = accounts.filter((a) => !a.archived && a.kind !== 'cash');

  return (
    <Pressable
      onPress={onToggle}
      accessibilityHint="Long-press to change the category"
      onLongPress={async () => {
        if (item.kind === 'transfer') return;
        tap();
        const kind = item.kind === 'income' ? 'income' : 'expense';
        const categoryId = await choose('Category', item.merchant || undefined, [
          ...categories.filter((c) => c.kind === kind).map((c) => ({ label: c.name, value: c.id as string | null, tone: (c.id === item.categoryId ? 'primary' : 'plain') as 'primary' | 'plain' })),
          { label: 'Cancel', value: null, tone: 'cancel' as const },
        ]);
        if (categoryId) updatePending(item.ref, { categoryId });
      }}
      style={[styles.row, !checked && { opacity: 0.55 }]}>
      <View style={[styles.check, checked && { backgroundColor: C.volt, borderColor: C.volt }]}>{checked && <Icon name="check" size={14} color={C.ink} strokeWidth={2.6} />}</View>
      <CategoryBadge color={color} icon={item.kind === 'transfer' ? 'cash' : (cat?.icon ?? 'dot')} size={36} />
      <View style={{ flex: 1 }}>
        <Txt variant="medium" numberOfLines={1}>
          {item.merchant || (item.kind === 'income' ? 'Money received' : 'Payment')}
        </Txt>
        <Txt variant="mono" style={{ marginTop: 2 }} numberOfLines={1}>
          {item.source === 'sms' ? 'SMS' : 'APP'} · {timeLabel(new Date(item.time).toISOString())} · {cat?.name ?? (item.kind === 'transfer' ? 'TO CASH' : '')}
        </Txt>
        {acc ? (
          <Txt variant="mono" style={{ marginTop: 2, color: C.text2 }}>
            {acc.name.toUpperCase()}
          </Txt>
        ) : (
          <Pressable
            onPress={async () => {
              const accountId = await choose('Which account?', item.raw.slice(0, 160), [
                ...live.map((a) => ({ label: a.name, value: a.id as string | null, icon: 'bank' as const, tone: 'plain' as const })),
                { label: 'Cancel', value: null, tone: 'cancel' as const },
              ]);
              if (accountId) updatePending(item.ref, { accountId });
            }}>
            <Txt style={{ marginTop: 2, fontSize: 12, color: C.warn }}>Pick account ›</Txt>
          </Pressable>
        )}
        {item.maybeDuplicate && <Txt style={{ marginTop: 2, fontSize: 11, color: C.ionText }}>Looks like an entry you already added</Txt>}
      </View>
      <Txt variant="strong" color={item.kind === 'income' ? C.volt : C.text}>
        {item.kind === 'income' ? inr(item.amount, { sign: true }) : item.kind === 'expense' ? inr(-item.amount) : inr(item.amount)}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  permIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  allow: { height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.volt, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.line2, alignItems: 'center', justifyContent: 'center' },
});
