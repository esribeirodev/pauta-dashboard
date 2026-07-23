import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ROLES } from '../constants';
import './admin.css';

const FLAGS = [
  ['create_demands', 'Criar demandas'],
  ['receive_demands', 'Receber demandas'],
  ['approve', 'Aprovar'],
  ['manage_clients', 'Gerenciar clientes'],
  ['manage_workspace', 'Gerenciar área'],
  ['all_workspaces', 'Ver todas as áreas']
];

const DEFAULT_PERMS = {
  admin:        { create_demands: true,  approve: true,  receive_demands: true, manage_clients: true,  manage_workspace: true },
  supervisora:  { create_demands: true,  approve: true,  receive_demands: true, manage_clients: true,  manage_workspace: false },
  estrategista: { create_demands: true,  approve: true,  receive_demands: true, manage_clients: false, manage_workspace: false },
  design:       { create_demands: false, approve: false, receive_demands: true, manage_clients: false, manage_workspace: false },
  editora:      { create_demands: false, approve: false, receive_demands: true, manage_clients: false, manage_workspace: false },
  videomaker:   { create_demands: false, approve: false, receive_demands: true, manage_clients: false, manage_workspace: false }
};

export default function AdminWorkspaces({ users, setNotice }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [newArea, setNewArea] = useState('');
  const [adding, setAdding] = useState({});

  const ok = text => setNotice(text);
  const fail = text => setNotice({ type: 'error', text });

  async function load() {
    const [ws, rs, ms] = await Promise.all([
      supabase.from('workspaces').select('*').order('name'),
      supabase.from('workspace_roles').select('*').order('name'),
      supabase
        .from('workspace_members')
        .select('*, profile:profiles(id, full_name), role:workspace_roles(id, name, permissions)')
    ]);
    setWorkspaces(ws.data || []);
    setRoles(rs.data || []);
    setMembers(ms.data || []);
  }

  useEffect(() => { load(); }, []);

  async function createArea(event) {
    event.preventDefault();
    const name = newArea.trim();
    if (!name) return;

    const { data: ws, error } = await supabase
      .from('workspaces')
      .insert({ name, active: true })
      .select()
      .single();
    if (error) return fail(error.message);

    const seed = Object.entries(DEFAULT_PERMS).map(([roleName, perms]) => ({
      workspace_id: ws.id,
      name: roleName,
      permissions: perms
    }));
    const { error: rolesError } = await supabase.from('workspace_roles').insert(seed);
    if (rolesError) return fail(`Área criada, mas os cargos padrão não foram criados: ${rolesError.message}`);

    setNewArea('');
    ok(`Área "${name}" criada com os cargos padrão.`);
    await load();
  }

  async function renameArea(ws) {
    const name = window.prompt('Nome da área', ws.name);
    if (name === null || !name.trim() || name.trim() === ws.name) return;

    const { error } = await supabase.from('workspaces').update({ name: name.trim() }).eq('id', ws.id);
    if (error) return fail(error.message);
    ok('Área renomeada com sucesso.');
    await load();
  }

  async function toggleArea(ws) {
    const action = ws.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} a área "${ws.name}"?`)) return;

    const { error } = await supabase.from('workspaces').update({ active: !ws.active }).eq('id', ws.id);
    if (error) return fail(error.message);
    ok(ws.active ? 'Área desativada com sucesso.' : 'Área reativada com sucesso.');
    await load();
  }

  async function addMember(ws) {
    const sel = adding[ws.id] || {};
    if (!sel.userId || !sel.roleId) return fail('Escolha o usuário e o cargo na área.');

    const { error } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: ws.id, user_id: sel.userId, role_id: sel.roleId });
    if (error) {
      return fail(error.code === '23505' ? 'Este usuário já é membro desta área.' : error.message);
    }

    setAdding({ ...adding, [ws.id]: {} });
    ok('Membro adicionado à área.');
    await load();
  }

  async function removeMember(member) {
    if (!window.confirm(`Remover "${member.profile?.full_name}" desta área?`)) return;

    const { error } = await supabase.from('workspace_members').delete().eq('id', member.id);
    if (error) return fail(error.message);
    ok('Membro removido da área.');
    await load();
  }

  async function changeRole(member, roleId) {
    /* Troca de cargo zera os ajustes manuais para evitar combinações confusas */
    const { error } = await supabase
      .from('workspace_members')
      .update({ role_id: roleId, overrides: {} })
      .eq('id', member.id);
    if (error) return fail(error.message);
    ok('Cargo atualizado (ajustes manuais foram resetados).');
    await load();
  }

  async function toggleFlag(member, flag) {
    const rolePerm = member.role?.permissions?.[flag] === true;
    const current = typeof member.overrides?.[flag] === 'boolean' ? member.overrides[flag] : rolePerm;
    const next = !current;

    const overrides = { ...(member.overrides || {}) };
    if (next === rolePerm) delete overrides[flag];
    else overrides[flag] = next;

    const { error } = await supabase
      .from('workspace_members')
      .update({ overrides })
      .eq('id', member.id);
    if (error) return fail(error.message);
    await load();
  }

  return (
    <section className="panel admin-full">
      <h2>Áreas de trabalho</h2>
      <p className="hint">
        Crie áreas, defina o cargo de cada usuário em cada área e ajuste permissões individualmente.
        Flags em dourado indicam ajuste manual diferente do padrão do cargo — desmarque/marque de novo para voltar ao padrão.
      </p>

      <form className="form-grid" onSubmit={createArea}>
        <input
          required placeholder="Nova área (ex.: Audiovisual)" value={newArea}
          onChange={e => setNewArea(e.target.value)}
        />
        <button className="primary">Criar área</button>
      </form>

      {workspaces.map(ws => {
        const wsRoles = roles.filter(r => r.workspace_id === ws.id);
        const wsMembers = members.filter(m => m.workspace_id === ws.id);
        const available = users.filter(u => u.active && !wsMembers.some(m => m.user_id === u.id));

        return (
          <div className="ws-card" key={ws.id}>
            <div className="ws-head">
              <div className="ws-head-title">
                <strong>{ws.name}</strong>
                <span className={ws.active ? 'badge active' : 'badge inactive'}>
                  {ws.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div className="ws-head-actions">
                <button className="secondary" onClick={() => renameArea(ws)}>Renomear</button>
                <button
                  className={ws.active ? 'danger' : 'primary'}
                  onClick={() => toggleArea(ws)}
                >
                  {ws.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>

            {wsMembers.map(member => (
              <div className="member-row" key={member.id}>
                <div className="member-main">
                  <strong>{member.profile?.full_name}</strong>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={member.role_id} onChange={e => changeRole(member, e.target.value)}>
                      {wsRoles.map(r => (
                        <option key={r.id} value={r.id}>{ROLES[r.name] || r.name}</option>
                      ))}
                    </select>
                    <button className="danger" onClick={() => removeMember(member)}>Remover</button>
                  </div>
                </div>
                <div className="flags">
                  {FLAGS.map(([flag, label]) => {
                    const overridden = typeof member.overrides?.[flag] === 'boolean';
                    const checked = overridden
                      ? member.overrides[flag]
                      : member.role?.permissions?.[flag] === true;
                    return (
                      <label
                        key={flag}
                        className={overridden ? 'flag overridden' : 'flag'}
                        title={overridden ? 'Ajustado manualmente (diferente do padrão do cargo)' : 'Padrão do cargo'}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleFlag(member, flag)} />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {!wsMembers.length && (
              <div className="empty" style={{ padding: '18px 0' }}>Nenhum membro nesta área.</div>
            )}

            <div className="ws-add-member">
              <select
                value={adding[ws.id]?.userId || ''}
                onChange={e => setAdding({ ...adding, [ws.id]: { ...adding[ws.id], userId: e.target.value } })}
              >
                <option value="">Adicionar usuário…</option>
                {available.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
              <select
                value={adding[ws.id]?.roleId || ''}
                onChange={e => setAdding({ ...adding, [ws.id]: { ...adding[ws.id], roleId: e.target.value } })}
              >
                <option value="">Cargo na área…</option>
                {wsRoles.map(r => <option key={r.id} value={r.id}>{ROLES[r.name] || r.name}</option>)}
              </select>
              <button className="secondary" onClick={() => addMember(ws)}>Adicionar</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
