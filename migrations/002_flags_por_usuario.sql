-- ============================================================
-- 002: Flags de permissão POR USUÁRIO (overrides por membro)
-- JÁ APLICADA no banco em produção — arquivo mantido para histórico.
-- O override, quando presente, vence o padrão do cargo.
-- ============================================================

alter table workspace_members
  add column if not exists overrides jsonb not null default '{}'::jsonb;
-- ex.: {"approve": true}  -> este membro aprova mesmo que o cargo não aprove
-- ex.: {"create_demands": false} -> este membro não cria demandas mesmo sendo estrategista

create or replace function has_permission(perm text, ws uuid default null)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_admin() or exists (
    select 1 from workspace_members m
    join workspace_roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and (ws is null or m.workspace_id = ws)
      and coalesce(
        (m.overrides ->> perm)::boolean,
        coalesce((r.permissions ->> perm)::boolean, false)
      )
  );
$$;

-- ws_select passa a considerar o override de all_workspaces
drop policy if exists ws_select on workspaces;
create policy ws_select on workspaces for select to authenticated
  using (
    is_admin()
    or exists (select 1 from workspace_members m where m.workspace_id = id and m.user_id = auth.uid())
    or exists (
      select 1 from workspace_members m
      join workspace_roles r on r.id = m.role_id
      where m.user_id = auth.uid()
        and coalesce((m.overrides ->> 'all_workspaces')::boolean,
                     coalesce((r.permissions ->> 'all_workspaces')::boolean, false))
    )
  );
