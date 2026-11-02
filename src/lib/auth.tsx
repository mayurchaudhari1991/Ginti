import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase, supabaseConfigured } from '@/lib/supabase';

export type AuthMode = 'login' | 'signup';

type AuthState = {
  session: Session | null;
  ready: boolean;
  /** Set when an email link was expired or already used. */
  linkError: string | null;
  sendCode: (email: string, mode: AuthMode, name?: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Turns Supabase's auth errors into something a person can act on. */
function friendly(message: string) {
  if (/signups? not allowed|user not found/i.test(message)) return 'No Ginti account uses this email yet. Switch to Sign up.';
  if (/rate limit|too many/i.test(message)) return 'Too many emails were sent in the last hour. Please try again a little later.';
  if (/after \d+ seconds/i.test(message)) return 'Please wait a minute before asking for another email.';
  if (/expired|invalid/i.test(message)) return 'That code or link has expired or was already used. Send a new one.';
  return message;
}

function fail(error: { message: string }): never {
  throw new Error(friendly(error.message));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    // Tapping the email link opens ginti://auth-callback#access_token=…&refresh_token=…
    const fromUrl = async (url: string | null) => {
      const hash = url?.split('#')[1];
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const error = params.get('error_description');
      if (error) {
        setLinkError(friendly(error.replace(/\+/g, ' ')));
        return;
      }
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        setLinkError(null);
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    };
    Linking.getInitialURL().then(fromUrl);
    const link = Linking.addEventListener('url', ({ url }) => fromUrl(url));
    return () => {
      data.subscription.unsubscribe();
      link.remove();
    };
  }, []);

  const value: AuthState = {
    session,
    ready,
    linkError,
    async sendCode(email, mode, name) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === 'signup',
          data: mode === 'signup' && name ? { display_name: name } : undefined,
        },
      });
      if (error) fail(error);
    },
    async verifyCode(email, code) {
      // A pasted email link also works: its `token` query value is the hashed one-time code.
      const link = code.match(/[?&]token=([^&\s]+)/);
      if (link) {
        const type = code.match(/[?&]type=([^&\s]+)/)?.[1] === 'signup' ? 'signup' : 'magiclink';
        const { error } = await supabase.auth.verifyOtp({ token_hash: decodeURIComponent(link[1]), type });
        if (error) fail(error);
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) fail(error);
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async updateName(name) {
      const { data, error } = await supabase.auth.updateUser({ data: { display_name: name } });
      if (error) fail(error);
      if (data.user) await supabase.from('profiles').update({ display_name: name }).eq('id', data.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
