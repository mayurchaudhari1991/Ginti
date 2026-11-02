-- Use the name typed on the sign-up screen (user metadata) for the profile, falling back to the email.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)));

  insert into public.accounts (user_id, name, kind, color)
  values (new.id, 'Cash wallet', 'cash', '#C8FF4D');

  insert into public.categories (user_id, name, color, icon, kind, sort) values
    (new.id, 'Food', '#FF8A4C', 'food', 'expense', 1),
    (new.id, 'Home', '#5B8CFF', 'home', 'expense', 2),
    (new.id, 'Shopping', '#FF5FA2', 'bag', 'expense', 3),
    (new.id, 'Travel', '#4CC9FF', 'bus', 'expense', 4),
    (new.id, 'Bills', '#FFD23F', 'bolt', 'expense', 5),
    (new.id, 'Health', '#3DDC97', 'heart', 'expense', 6),
    (new.id, 'Fun', '#9B8CFF', 'game', 'expense', 7),
    (new.id, 'Other', '#8A90A2', 'dot', 'expense', 8),
    (new.id, 'Salary', '#C8FF4D', 'wallet', 'income', 1),
    (new.id, 'Other income', '#3DDC97', 'dot', 'income', 2);
  return new;
end;
$$;
