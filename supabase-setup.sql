-- Run once in this project's Supabase SQL Editor.
-- This board deliberately allows anyone with the website link to read and edit.
-- Only the three Dalal documents are exposed, with revision checks on every save.
begin;

create table if not exists public.dalal_shared_documents (
  key text primary key check (key in (
    'dalal-project-board-v1',
    'dalal-hail-review-2026-11-16',
    'dalal-hail-catalog-2026-11-16'
  )),
  value jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.dalal_shared_documents enable row level security;
revoke all on public.dalal_shared_documents from anon, authenticated;
grant select on public.dalal_shared_documents to anon, authenticated;
drop policy if exists dalal_public_read on public.dalal_shared_documents;
create policy dalal_public_read on public.dalal_shared_documents
  for select to anon, authenticated using (true);

create or replace function public.dalal_save_document(
  p_key text, p_value jsonb, p_expected_revision bigint
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_row public.dalal_shared_documents%rowtype;
begin
  if p_key is null or p_key not in ('dalal-project-board-v1', 'dalal-hail-review-2026-11-16', 'dalal-hail-catalog-2026-11-16') then
    raise exception 'Unknown document';
  end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 8388608 then
    raise exception 'Invalid document or document exceeds 8 MB';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision'; end if;
  if p_expected_revision = 0 then
    insert into public.dalal_shared_documents(key,value)
      values(p_key,p_value) on conflict (key) do nothing
      returning * into current_row;
    if found then return jsonb_build_object('ok',true,'document',to_jsonb(current_row)); end if;
  end if;
  select * into current_row from public.dalal_shared_documents where key=p_key for update;
  if not found then return jsonb_build_object('ok',false,'document',null); end if;
  if current_row.revision <> p_expected_revision then
    return jsonb_build_object('ok',false,'document',to_jsonb(current_row));
  end if;
  update public.dalal_shared_documents set value=p_value,revision=revision+1,updated_at=now()
    where key=p_key returning * into current_row;
  return jsonb_build_object('ok',true,'document',to_jsonb(current_row));
end;
$$;
revoke all on function public.dalal_save_document(text,jsonb,bigint) from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function public.dalal_save_document(text,jsonb,bigint) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
