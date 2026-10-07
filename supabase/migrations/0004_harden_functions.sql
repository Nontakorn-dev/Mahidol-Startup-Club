-- Trigger functions must not be callable through the REST API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
-- Keep extensions out of the exposed schema.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
