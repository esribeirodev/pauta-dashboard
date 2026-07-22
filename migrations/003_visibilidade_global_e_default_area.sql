-- ============================================================
-- 003: Visibilidade global (all_workspaces) + área padrão
-- ============================================================

-- 1) Supervisor geral (all_workspaces) agora ENXERGA todas as áreas,
--    mesmo sem ser membro delas.
drop policy ws_select on workspaces;
create policy ws_select on workspaces for select to authenticated
  using (
    is_admin()
    or exists (select 1 from workspace_members m
               where m.workspace_id = id and m.user_id = auth.uid())
    or exists (select 1 from workspace_members m
               join workspace_roles r on r.id = m.role_id
               where m.user_id = auth.uid()
                 and coalesce((r.permissions ->> 'all_workspaces')::boolean, false))
  );

-- 2) Toda demanda nova recebe área automaticamente:
--    área do criador (primeira membership) ou 'Geral' como fallback.
--    Garante zero demandas órfãs independente do frontend.
create or replace function set_default_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workspace_id is null then
    select m.workspace_id into new.workspace_id
    from workspace_members m
    where m.user_id = new.created_by
    order by m.created_at
    limit 1;
    if new.workspace_id is null then
      select id into new.workspace_id from workspaces where name = 'Geral' limit 1;
    end if;
  end if;
  return new;
end $$;

create trigger trg_default_workspace
before insert on content_items
for each row execute function set_default_workspace();
