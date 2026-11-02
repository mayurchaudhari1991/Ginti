import type { Session } from '@supabase/supabase-js';

/** A friendly first name from the sign-in email: "mayur.c@x.com" becomes "Mayur". */
export function firstName(session: Session | null) {
  const local = session?.user.email?.split('@')[0] ?? '';
  const word = local.split(/[._\-+0-9]/)[0];
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : undefined;
}
