import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase, supabaseConfigured } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  ready: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Error text from a failed email link, shown on the sign-in screen. */
export let lastLinkError: string | null = null;

async function sessionFromUrl(url: string) {
  const hash = url.split('#')[1];
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const error = params.get('error_description');
  if (error) {
    lastLinkError = error.replace(/\+/g, ' ');
    return;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    // Tapping the email link opens ginti://auth-callback#access_token=…&refresh_token=…
    Linking.getInitialURL().then((url) => {
      if (url) sessionFromUrl(url);
    });
    const link = Linking.addEventListener('url', ({ url }) => sessionFromUrl(url));
    return () => {
      data.subscription.unsubscribe();
      link.remove();
    };
  }, []);

  const value: AuthState = {
    session,
    ready,
    async sendCode(email) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
    },
    async verifyCode(email, code) {
      // Supabase's stock emails carry only a link; its `token` query value is the hashed OTP, so a
      // pasted link works as well as a 6-digit code until the email template is customised.
      const link = code.match(/[?&]token=([^&\s]+)/);
      if (link) {
        const type = code.match(/[?&]type=([^&\s]+)/)?.[1] === 'signup' ? 'signup' : 'magiclink';
        const { error } = await supabase.auth.verifyOtp({ token_hash: decodeURIComponent(link[1]), type });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
