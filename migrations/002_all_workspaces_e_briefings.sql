-- ============================================================
-- 002: all_workspaces (supervisor geral) + assignment_briefings
-- Migração ADITIVA e retrocompatível.
-- ============================================================

-- 1) has_permission agora respeita a flag global all_workspaces.
--    Cargo com {"all_workspaces": true} enxerga/opera em TODAS as áreas
--    (inclusive futuras), sem ser admin do sistema.
create or replace function has_permission(perm text, ws uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from workspace_members m
    join workspace_roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and coalesce((r.permissions ->> perm)::boolean, false)
      and (ws is null
           or m.workspace_id = ws
           or coalesce((r.permissions ->> 'all_workspaces')::boolean, false))
  );
$$;

-- 2) Briefing individual por atribuição ("Campo 1 / Campo 2").
--    Cada pessoa atribuída só enxerga o PRÓPRIO texto e a PRÓPRIA pasta
--    do Drive; criador e aprovadores da área enxergam todos.
create table assignment_briefings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references content_assignments(id) on delete cascade,
  content_id uuid not null references content_items(id) on delete cascade,
  instructions text,
  drive_folder_id text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id)
);

alter table assignment_briefings enable row level security;

create policy ab_select on assignment_briefings for select to authenticated
  using (
    is_admin()
    or created_by = auth.uid()
    or exists (select 1 from content_assignments a
               where a.id = assignment_id and a.assigned_to = auth.uid())
    or exists (select 1 from content_items ci
               where ci.id = content_id and has_permission('approve', ci.workspace_id))
  );

create policy ab_insert on assignment_briefings for insert to authenticated
  with check (
    is_admin()
    or exists (select 1 from content_items ci
               where ci.id = content_id
                 and (has_permission('create_demands', ci.workspace_id)
                      or has_permission('approve', ci.workspace_id)))
  );

create policy ab_update on assignment_briefings for update to authenticated
  using (
    is_admin() or created_by = auth.uid()
    or exists (select 1 from content_items ci
               where ci.id = content_id and has_permission('approve', ci.workspace_id))
  )
  with check (
    is_admin() or created_by = auth.uid()
    or exists (select 1 from content_items ci
               where ci.id = content_id and has_permission('approve', ci.workspace_id))
  );

create policy ab_delete on assignment_briefings for delete to authenticated
  using (
    is_admin() or created_by = auth.uid()
    or exists (select 1 from content_items ci
               where ci.id = content_id and has_permission('approve', ci.workspace_id))
  );

-- Decisão de produto registrada (Fase 4): na tarefa dividida,
-- o gestor APROVA POR PESSOA; a demanda conclui quando todas as
-- atribuições estiverem aprovadas.
