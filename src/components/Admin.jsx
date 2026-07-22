import React, { useState } from 'react';
import { supabase } from '../supabase';
import { ROLES } from '../constants';

export default function Admin({ users, clients, reload, setNotice }) {
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'design', password: '' });
  const [newClient, setNewClient] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  async function invokeAdmin(body) {
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (error || data?.error) {
      throw new Error(error?.message || data?.error || 'Não foi possível concluir a operação.');
    }
    return data;
  }

  /* ---------- Usuários ---------- */

  async function toggleUser(user) {
    const action = user.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} o usuário "${user.full_name}"?`)) return;

    try {
      await invokeAdmin({ action: 'set_active', userId: user.id, active: !user.active });
      setNotice(user.active ? 'Usuário desativado com sucesso.' : 'Usuário reativado com sucesso.');
      await reload();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function createUser(event) {
    event.preventDefault();

    if (!newUser.email.trim() || !newUser.name.trim() || !newUser.password) {
      alert('Preencha e-mail, nome e senha.');
      return;
    }
    if (newUser.password.length < 8) {
      alert('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    try {
      await invokeAdmin({
        action: 'create',
        email: newUser.email.trim(),
        fullName: newUser.name.trim(),
        role: newUser.role,
        password: newUser.password
      });
      alert('Usuário criado com sucesso.');
      setNewUser({ email: '', name: '', role: 'design', password: '' });
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  function startEditUser(user) {
    setEditingUser({ id: user.id, name: user.full_name, role: user.role });
  }

  async function saveEditUser(event) {
    event.preventDefault();
    if (!editingUser?.name.trim()) {
      alert('Informe o nome do usuário.');
      return;
    }

    try {
      await invokeAdmin({
        action: 'update_profile',
        userId: editingUser.id,
        fullName: editingUser.name.trim(),
        role: editingUser.role
      });
      setNotice('Perfil atualizado com sucesso.');
      setEditingUser(null);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(`Nova senha para "${user.full_name}" (mínimo 8 caracteres):`);
    if (password === null) return;
    if (password.length < 8) {
      alert('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    try {
      await invokeAdmin({ action: 'set_password', userId: user.id, password });
      setNotice(`Senha de "${user.full_name}" redefinida com sucesso.`);
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteUser(user) {
    const typed = window.prompt(
      `⚠️ Esta ação é PERMANENTE e não pode ser desfeita.\n\nPara excluir, digite o nome exato do usuário:\n"${user.full_name}"`
    );
    if (typed === null) return;
    if (typed.trim() !== user.full_name) {
      alert('O nome digitado não confere. Exclusão cancelada.');
      return;
    }

    try {
      await invokeAdmin({ action: 'delete', userId: user.id });
      setNotice('Usuário excluído com sucesso.');
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  /* ---------- Clientes ---------- */

  async function addClient(event) {
    event.preventDefault();

    const { error } = await supabase.from('clients').insert({ name: newClient, active: true });
    if (error) {
      setNotice(error.message);
      return;
    }

    setNewClient('');
    await reload();
  }

  async function toggleClient(client) {
    const action = client.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} o cliente "${client.name}"?`)) return;

    const { error } = await supabase
      .from('clients')
      .update({ active: !client.active, updated_at: new Date().toISOString() })
      .eq('id', client.id);

    if (error) {
      setNotice(error.message || 'Não foi possível alterar o cliente.');
      return;
    }

    setNotice(client.active ? 'Cliente desativado com sucesso.' : 'Cliente reativado com sucesso.');
    await reload();
  }

  async function editClient(client) {
    const name = window.prompt('Nome do cliente', client.name);
    if (name === null || !name.trim() || name.trim() === client.name) return;

    const { error } = await supabase
      .from('clients')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', client.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice('Cliente atualizado com sucesso.');
    await reload();
  }

  async function deleteClient(client) {
    const { count, error: countError } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id);

    if (countError) {
      setNotice(countError.message);
      return;
    }

    if (count > 0) {
      alert(
        `O cliente "${client.name}" possui ${count} demanda(s) vinculada(s) e não pode ser excluído.\n` +
        'Desative-o para preservar o histórico.'
      );
      return;
    }

    const typed = window.prompt(
      `⚠️ Esta ação é PERMANENTE e não pode ser desfeita.\n\nPara excluir, digite o nome exato do cliente:\n"${client.name}"`
    );
    if (typed === null) return;
    if (typed.trim() !== client.name) {
      alert('O nome digitado não confere. Exclusão cancelada.');
      return;
    }

    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice('Cliente excluído com sucesso.');
    await reload();
  }

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Usuários</h2>
        <p className="hint">A criação segura de usuários utiliza uma Edge Function.</p>

        <div className="table">
          {users.map(user => (
            <div className="row" key={user.id}>
              {editingUser?.id === user.id ? (
                <form onSubmit={saveEditUser} className="form-grid" style={{ flex: 1 }}>
                  <input
                    required placeholder="Nome completo" value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                  >
                    {Object.entries(ROLES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <button className="primary" type="submit">Salvar</button>
                  <button className="secondary" type="button" onClick={() => setEditingUser(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <div className="title">
                    <b>{user.full_name}</b>
                    <small>{ROLES[user.role] || user.role}</small>
                  </div>
                  <span className={user.active ? 'badge active' : 'badge inactive'}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button type="button" className="secondary" onClick={() => startEditUser(user)}>
                    Editar
                  </button>
                  <button type="button" className="secondary" onClick={() => resetPassword(user)}>
                    Senha
                  </button>
                  <button
                    type="button"
                    className={user.active ? 'danger' : 'primary'}
                    onClick={() => toggleUser(user)}
                  >
                    {user.active ? 'Desativar' : 'Reativar'}
                  </button>
                  <button type="button" className="danger" onClick={() => deleteUser(user)}>
                    Excluir
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={createUser} className="form-grid">
          <input
            required type="email" placeholder="E-mail" value={newUser.email}
            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
          />
          <input
            required placeholder="Nome completo" value={newUser.name}
            onChange={e => setNewUser({ ...newUser, name: e.target.value })}
          />
          <select
            value={newUser.role}
            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
          >
            {Object.entries(ROLES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            required type="password" minLength="8" placeholder="Senha inicial"
            value={newUser.password}
            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
          />
          <button className="secondary">Criar usuário</button>
        </form>
      </section>

      <section className="panel">
        <h2>Clientes</h2>

        <form className="form-grid" onSubmit={addClient}>
          <input
            required placeholder="Novo cliente" value={newClient}
            onChange={e => setNewClient(e.target.value)}
          />
          <button className="primary">Adicionar</button>
        </form>

        {clients.length ? (
          clients.map(client => (
            <div className="admin-row" key={client.id}>
              <div>
                <strong>{client.name}</strong>
                <span className={client.active ? 'badge active' : 'badge inactive'}>
                  {client.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="admin-row-actions">
                <button className="secondary" onClick={() => editClient(client)}>Editar</button>
                <button
                  className={client.active ? 'danger' : 'primary'}
                  onClick={() => toggleClient(client)}
                >
                  {client.active ? 'Desativar' : 'Reativar'}
                </button>
                <button className="danger" onClick={() => deleteClient(client)}>Excluir</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">Nenhum cliente encontrado.</div>
        )}
      </section>
    </div>
  );
}
