import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth';
import { getPrefs } from '@/lib/prefs';

type LockState = {
  locked: boolean;
  available: boolean;
  unlock: () => Promise<{ ok: boolean; reason?: string }>;
};

const LockContext = createContext<LockState | null>(null);

export function LockProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const hadSession = useRef(false);

  useEffect(() => {
    (async () => {
      const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setAvailable(ok);
    })();
  }, []);

  // Lock once when a stored session is restored on launch, not right after a fresh sign-in.
  useEffect(() => {
    if (session && !hadSession.current && available && getPrefs().biometricLock) setLocked(true);
    hadSession.current = !!session;
  }, [session, available]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current) {
        const away = (Date.now() - backgroundedAt.current) / 1000;
        backgroundedAt.current = null;
        const prefs = getPrefs();
        if (session && available && prefs.biometricLock && away >= prefs.autoLockSeconds) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [session, available]);

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Ginti',
      promptSubtitle: 'Use your fingerprint or face',
      cancelLabel: 'Cancel',
    });
    if (res.success) {
      setLocked(false);
      return { ok: true };
    }
    return { ok: false, reason: res.error };
  }, []);

  return <LockContext.Provider value={{ locked, available, unlock }}>{children}</LockContext.Provider>;
}

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used inside LockProvider');
  return ctx;
}
