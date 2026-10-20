-- Anonymous requests ("ขอทำความรู้จัก") must not reveal who is on the other side before they are
-- accepted. The browser could read conversations.created_by / last_sender_id and messages.sender_id
-- directly (RLS let members read them, and Realtime pushed whole message rows) — enough to open
-- /u/<id> and see the name. Chat data is now server-only; open chats refresh via
-- conversation_pings (0023).

-- Pings are written by the server only.
revoke insert, update, delete, truncate on public.conversation_pings from anon, authenticated;

-- Nothing in the browser reads chat tables any more: no policies, no grants, no Realtime rows.
alter publication supabase_realtime drop table public.messages;
drop policy if exists "members read conversations" on public.conversations;
drop policy if exists "members read participants" on public.conversation_participants;
drop policy if exists "members read messages" on public.messages;
revoke all on public.conversations, public.conversation_participants, public.messages from anon, authenticated;
drop function if exists public.is_conversation_member(uuid);
