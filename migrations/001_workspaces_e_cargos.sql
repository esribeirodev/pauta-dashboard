-- ============================================================
-- 001: Áreas de trabalho, cargos dinâmicos e multi-atribuição
-- Migração ADITIVA: não altera nem remove nada do schema atual.
-- Retrocompatível: cria área "Geral" e migra cargos/membros atuais.
-- ============================================================

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table workspace_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  permissions jsonb not null default '{}'::jsonb,
  -- ex.: {"create_demands":true,"approve":true,"receive_demands":false,
  --       "manage_clients":false,"manage_workspace":false}
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references workspace_roles(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table content_items
  add column workspace_id uuid references workspaces(id);

alter table content_assignments
  add column instructions text,
  add column drive_folder_id text;

-- helper: usuário tem a permissão X em alguma área (ou na área específica)
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
      and coalesce((r.permissions ->> perm)::boolean, false)
  );
$$;

-- ============ seed de retrocompatibilidade ============
do $$
declare g uuid; r record; rid uuid;
begin
  insert into workspaces (name) values ('Geral') returning id into g;

  for r in
    select * from (values
      ('admin',        '{"create_demands":true,"approve":true,"receive_demands":true,"manage_clients":true,"manage_workspace":true}'),
      ('supervisora',  '{"create_demands":true,"approve":true,"receive_demands":true,"manage_clients":true,"manage_workspace":false}'),
      ('estrategista', '{"create_demands":true,"approve":true,"receive_demands":true,"manage_clients":false,"manage_workspace":false}'),
      ('design',       '{"create_demands":false,"approve":false,"receive_demands":true,"manage_clients":false,"manage_workspace":false}'),
      ('editora',      '{"create_demands":false,"approve":false,"receive_demands":true,"manage_clients":false,"manage_workspace":false}'),
      ('videomaker',   '{"create_demands":false,"approve":false,"receive_demands":true,"manage_clients":false,"manage_workspace":false}')
    ) as t(role_name, perms)
  loop
    insert into workspace_roles (workspace_id, name, permissions)
    values (g, r.role_name, r.perms::jsonb) returning id into rid;

    insert into workspace_members (workspace_id, user_id, role_id)
    select g, p.id, rid from profiles p where p.role = r.role_name;
  end loop;

  update content_items set workspace_id = g where workspace_id is null;
end $$;

-- ============ RLS ============
alter table workspaces enable row level security;
alter table workspace_roles enable row level security;
alter table workspace_members enable row level security;

create policy ws_select on workspaces for select to authenticated
  using (is_admin() or exists (select 1 from workspace_members m
         where m.workspace_id = id and m.user_id = auth.uid()));
create policy ws_admin_all on workspaces for all to authenticated
  using (is_admin()) with check (is_admin());

create policy wsroles_select on workspace_roles for select to authenticated
  using (true);
create policy wsroles_manage on workspace_roles for all to authenticated
  using (is_admin() or has_permission('manage_workspace', workspace_id))
  with check (is_admin() or has_permission('manage_workspace', workspace_id));

create policy wsmembers_select on workspace_members for select to authenticated
  using (true);
create policy wsmembers_manage on workspace_members for all to authenticated
  using (is_admin() or has_permission('manage_workspace', workspace_id))
  with check (is_admin() or has_permission('manage_workspace', workspace_id));

-- Obs.: o sigilo por campo (Campo 1 / Campo 2) será blindado na Fase 2
-- movendo instructions para tabela assignment_briefings com RLS própria.
