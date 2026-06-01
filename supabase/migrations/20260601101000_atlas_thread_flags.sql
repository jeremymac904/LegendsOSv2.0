-- LegendsOS v2 — Atlas thread management flags
-- Additive only: keeps existing chat_threads behavior and adds saved/pinned
-- conversation controls for the Atlas workspace.

alter table public.chat_threads
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_saved boolean not null default false;

create index if not exists idx_chat_threads_pinned
  on public.chat_threads(user_id, is_pinned, last_message_at desc);

create index if not exists idx_chat_threads_saved
  on public.chat_threads(user_id, is_saved, last_message_at desc);
