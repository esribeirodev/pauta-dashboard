import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

/*
 * Painel de Áreas de trabalho e Cargos (Fase 3).
 * - CRUD de áreas (workspaces)
 * - Cargos por área com checkboxes de permissão (JSONB)
 * - Membros por área (usuário + cargo)
 * Renderizado dentro do admin-grid da aba Administração.
 */
const PERMS = {
  create_demands: 'Criar demandas',
  receive_demands: 'Receber demandas',
  approve: 'Aprovar demandas',
  manage_clients: 'Gerenciar clientes',
  manage_workspace: 'Gerenciar a área',
  all_workspaces: 'Acesso a todas as áreas (supervisão geral)'
};

export default function WorkspaceAdmin({ users, setNotice }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [selected, setSelected] = useState('');
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [newWs, setNewWs] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newMember, setNewMember] = useState({ userId: '', roleId: '' });

  useEffect(() => { loadWorkspaces(); }, []);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected]);

  async function loadWorkspaces() {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('active', { ascending: false })
      .order('name');

    if (error) { setNotice(error.message); return; }

    setWorkspaces(data || []);

    if (data?.length && !data.some(ws => ws.id === selected)) {
      setSelected(data[0].id);
    }
  }

  async function loadDetail(wsId) {
    const [rolesResult, membersResult] = await Promise.all([
      supabase
        .from('workspace_roles')
        .select('*')
        .eq('workspace_id', wsId)
        .order('name'),
      supabase
        .from('workspace_members')
        .select('id, user_id, role_id, person:profiles!user_id(id, full_name, active), role:workspace_roles(id, name)')
        .eq('workspace_id', wsId)
    ]);

    if (rolesResult.error || membersResult.error) {
      setNotice(rolesResult.error?.message || membersResult.error?.message);
      return;
    }

    setRoles(rolesResult.data || []);
    setMembers(membersResult.data || []);
  }

  /* ---------- Áreas ---------- */

  async function addWorkspace(event) {
    event.preventDefault();
    const name = newWs.trim();
    if (!name) return;

    const { error } = await supabase.from('workspaces').insert({ name, active: true });
    if (error) { setNotice(error.message); return; }

    setNewWs('');
    setNotice('Área criada com sucesso.');
    await loadWorkspaces();
  }

  async function renameWorkspace(ws) {
    const name = window.prompt('Nome da área', ws.name);
    if (name === null || !name.trim() || name.trim() === ws.name) return;

    const { error } = await supabase
      .from('workspaces')
      .update({ name: name.trim() })
      .eq('id', ws.id);

    if (error) { setNotice(error.message); return; }
    await loadWorkspaces();
  }

  async function toggleWorkspace(ws) {
    const action = ws.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} a área "${ws.name}"?`)) return;

    const { error } = await supabase
      .from('workspaces')
      .update({ active: !ws.active })
      .eq('id', ws.id);

    if (error) { setNotice(error.message); return; }
    setNotice(ws.active ? 'Área desativada.' : 'Área reativada.');
    await loadWorkspaces();
  }

  /* ---------- Cargos ---------- */

  async function addRole(event) {
    event.preventDefault();
    const name = newRole.trim();
    if (!name || !selected) return;

    const { error } = await supabase
      .from('workspace_roles')
      .insert({ workspace_id: selected, name, permissions: {} });

    if (error) { setNotice(error.message); return; }

    setNewRole('');
    setNotice('Cargo criado. Configure as permissões abaixo.');
    await loadDetail(selected);
  }

  async function togglePerm(role, key) {
    const permissions = { ...(role.permissions || {}), [key]: !role.permissions?.[key] };

    const { error } = await supabase
      .from('workspace_roles')
      .update({ permissions })
      .eq('id', role.id);

    if (error) { setNotice(error.message); return; }
    await loadDetail(selected);
  }

  async function renameRole(role) {
    const name = window.prompt('Nome do cargo', role.name);
    if (name === null || !name.trim() || name.trim() === role.name) return;

    const { error } = await supabase
      .from('workspace_roles')
      .update({ name: name.trim() })
      .eq('id', role.id);

    if (error) { setNotice(error.message); return; }
    await loadDetail(selected);
  }

  async function deleteRole(role) {
    if (!window.confirm(`Excluir o cargo "${role.name}"?`)) return;

    const { error } = await supabase.from('workspace_roles').delete().eq('id', role.id);

    if (error) {
      setNotice('Não foi possível excluir: remova antes os membros que usam este cargo.');
      return;
    }

    setNotice('Cargo excluído.');
    await loadDetail(selected);
  }

  /* ---------- Membros ---------- */

  async function addMember(event) {
    event.preventDefault();
    if (!newMember.userId || !newMember.roleId) return;

    const { error } = await supabase.from('workspace_members').insert({
      workspace_id: selected,
      user_id: newMember.userId,
      role_id: newMember.roleId
    });

    if (error) { setNotice(error.message); return; }

    setNewMember({ userId: '', roleId: '' });
    setNotice('Membro adicionado à área.');
    await loadDetail(selected);
  }

  async function changeMemberRole(member, roleId) {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role_id: roleId })
      .eq('id', member.id);

    if (error) { setNotice(error.message); return; }
    await loadDetail(selected);
  }

  async function removeMember(member) {
    if (!window.confirm(`Remover "${member.person?.full_name}" desta área?`)) return;

    const { error } = await supabase.from('workspace_members').delete().eq('id', member.id);

    if (error) { setNotice(error.message); return; }
    setNotice('Membro removido da área.');
    await loadDetail(selected);
  }

  const currentWs = workspaces.find(ws => ws.id === selected);
  const activeUsers = (users || []).filter(user => user.active);
  const availableUsers = activeUsers.filter(
    user => !members.some(member => member.user_id === user.id)
  );

  return (
    <>
      <section className="panel">
        <h2>Áreas de trabalho</h2>
        <p className="hint">Cada área tem seus próprios cargos, permissões e membros.</p>

        <form className="form-grid" onSubmit={addWorkspace}>
          <input
            required placeholder="Nova área (ex.: Audiovisual)" value={newWs}
            onChange={e => setNewWs(e.target.value)}
          />
          <button className="primary">Adicionar</button>
        </form>

        {workspaces.map(ws => (
          <div className="admin-row" key={ws.id}>
            <div>
              <strong>{ws.name}</strong>
              <span className={ws.active ? 'badge active' : 'badge inactive'}>
                {ws.active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <div className="admin-row-actions">
              <button
                className={selected === ws.id ? 'primary' : 'secondary'}
                onClick={() => setSelected(ws.id)}
              >
                {selected === ws.id ? 'Selecionada' : 'Gerenciar'}
              </button>
              <button className="secondary" onClick={() => renameWorkspace(ws)}>Editar</button>
              <button
                className={ws.active ? 'danger' : 'primary'}
                onClick={() => toggleWorkspace(ws)}
              >
                {ws.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Cargos e membros {currentWs ? `— ${currentWs.name}` : ''}</h2>

        <form className="form-grid" onSubmit={addRole}>
          <input
            required placeholder="Novo cargo (ex.: Roteirista)" value={newRole}
            onChange={e => setNewRole(e.target.value)}
          />
          <button className="secondary">Criar cargo</button>
        </form>

        {roles.map(role => (
          <div className="admin-row" key={role.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{role.name}</strong>
              <div className="admin-row-actions">
                <button className="secondary" onClick={() => renameRole(role)}>Renomear</button>
                <button className="danger" onClick={() => deleteRole(role)}>Excluir</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              {Object.entries(PERMS).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={role.permissions?.[key] === true}
                    onChange={() => togglePerm(role, key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}

        {!roles.length && <div className="empty">Nenhum cargo nesta área ainda.</div>}

        <h2 style={{ marginTop: 20 }}>Membros da área</h2>

        <form className="form-grid" onSubmit={addMember}>
          <select
            required value={newMember.userId}
            onChange={e => setNewMember(prev => ({ ...prev, userId: e.target.value }))}
          >
            <option value="">Selecione a pessoa</option>
            {availableUsers.map(user => (
              <option key={user.id} value={user.id}>{user.full_name}</option>
            ))}
          </select>
          <select
            required value={newMember.roleId}
            onChange={e => setNewMember(prev => ({ ...prev, roleId: e.target.value }))}
          >
            <option value="">Selecione o cargo</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          <button className="primary">Adicionar membro</button>
        </form>

        {members.map(member => (
          <div className="admin-row" key={member.id}>
            <div>
              <strong>{member.person?.full_name}</strong>
            </div>
            <div className="admin-row-actions">
              <select
                value={member.role_id}
                onChange={e => changeMemberRole(member, e.target.value)}
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <button className="danger" onClick={() => removeMember(member)}>Remover</button>
            </div>
          </div>
        ))}

        {!members.length && <div className="empty">Nenhum membro nesta área.</div>}
      </section>
    </>
  );
}
