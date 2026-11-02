import { requireOptionalNativeModule } from 'expo';

/** A raw SMS or a captured payment-app notification. */
export type InboxMessage = { id: string; address: string; body: string; time: number };

type GintiInboxNative = {
  hasSmsPermission(): boolean;
  readSms(sinceMs: number, limit: number): Promise<InboxMessage[]>;
  hasNotificationAccess(): boolean;
  openNotificationAccessSettings(): void;
  drainNotifications(): InboxMessage[];
};

/** Null in Expo Go and on iOS, where the native module isn't built in. */
export default requireOptionalNativeModule<GintiInboxNative>('GintiInbox');
