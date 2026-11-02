import type { Session } from '@supabase/supabase-js';

/** The name typed at sign-up, else a friendly one from the email: "mayur.c@x.com" becomes "Mayur". */
export function firstName(session: Session | null) {
  const typed = String(session?.user.user_metadata?.display_name ?? '').trim();
  if (typed) return typed.split(/\s+/)[0];
  const local = session?.user.email?.split('@')[0] ?? '';
  const word = local.split(/[._\-+0-9]/)[0];
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : undefined;
}
