-- 004: Aprovador responsável pela demanda (fluxo de aprovação multinível)
--
-- Regra de negócio:
--   * O criador da demanda é o primeiro aprovador (default via trigger).
--   * Ao encaminhar para aprovação superior, o novo gestor passa a ser o
--     aprovador responsável (current_approver = destinatário).
--   * Quando o criativo reenvia após ajustes, a demanda volta SEMPRE para
--     current_approver, e não para created_by.

alter table public.content_items
  add column if not exists current_approver uuid references public.profiles(id);

-- Backfill: demandas existentes voltam para o criador (comportamento anterior)
update public.content_items
  set current_approver = created_by
  where current_approver is null;

-- Default automático no INSERT: criador é o primeiro aprovador
create or replace function public.set_default_approver()
returns trigger
language plpgsql
as $fn$
begin
  if new.current_approver is null then
    new.current_approver := new.created_by;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_default_approver on public.content_items;
create trigger trg_default_approver
  before insert on public.content_items
  for each row execute function public.set_default_approver();
