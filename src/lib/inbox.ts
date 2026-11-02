import 'expo-sqlite/localStorage/install';

import { useSyncExternalStore } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import GintiInbox from '@/modules/ginti-inbox';
import { dedupe, parseMessage, type Detected } from '@/lib/inbox-parse';
import type { Account, Category, Txn } from '@/lib/types';

const store = globalThis.localStorage as Storage | undefined;
const PENDING = 'ginti.inbox.pending';
const LAST_SCAN = 'ginti.inbox.lastScan';
const FIRST_SCAN_DAYS = 45;

/** False in Expo Go and on iOS: auto-import needs the Ginti APK. */
export const inboxAvailable = Platform.OS === 'android' && GintiInbox != null;

let pending: Detected[] = (() => {
  try {
    return JSON.parse(store?.getItem(PENDING) ?? '[]') as Detected[];
  } catch {
    return [];
  }
})();
const listeners = new Set<() => void>();

function setPending(next: Detected[]) {
  pending = next;
  store?.setItem(PENDING, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function usePendingImports() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
}

export function removePending(refs: string[]) {
  const drop = new Set(refs);
  setPending(pending.filter((p) => !drop.has(p.ref)));
}

export function updatePending(ref: string, patch: Partial<Detected>) {
  setPending(pending.map((p) => (p.ref === ref ? { ...p, ...patch } : p)));
}

export type InboxPermissions = { sms: boolean; notifications: boolean };

export function inboxPermissions(): InboxPermissions {
  if (!GintiInbox) return { sms: false, notifications: false };
  return { sms: GintiInbox.hasSmsPermission(), notifications: GintiInbox.hasNotificationAccess() };
}

export async function requestSmsPermission() {
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read bank SMS',
    message: 'Ginti reads transaction texts from your bank to add expenses for you. Messages never leave your phone.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export function openNotificationAccess() {
  GintiInbox?.openNotificationAccessSettings();
}

/**
 * Reads new bank SMS and captured payment notifications, and queues any payments not already in the
 * ledger for review. Returns how many new items were queued.
 */
export async function scanInbox(accounts: Account[], categories: Category[], txns: Txn[]) {
  if (!GintiInbox) return 0;
  const now = Date.now();
  const since = Number(store?.getItem(LAST_SCAN) ?? now - FIRST_SCAN_DAYS * 86400000);
  const [sms, notes] = await Promise.all([
    GintiInbox.hasSmsPermission() ? GintiInbox.readSms(since, 500) : Promise.resolve([]),
    Promise.resolve(GintiInbox.drainNotifications()),
  ]);
  const parsed = [
    ...sms.map((m) => parseMessage(m, 'sms', accounts, categories)),
    ...notes.map((m) => parseMessage(m, 'notification', accounts, categories)),
  ].filter((d): d is Detected => d != null);

  const known = new Set(pending.map((p) => p.ref));
  // A manual entry with the same amount within half an hour is probably this payment.
  const looksLogged = (d: Detected) =>
    txns.some((t) => t.amount === d.amount && Math.abs(new Date(t.occurred_at).getTime() - d.time) < 30 * 60 * 1000);
  const fresh = dedupe(parsed)
    .filter((d) => !known.has(d.ref))
    .map((d) => (looksLogged(d) ? { ...d, maybeDuplicate: true } : d));

  store?.setItem(LAST_SCAN, String(now));
  if (fresh.length) setPending(dedupe([...fresh, ...pending]));
  return fresh.length;
}
