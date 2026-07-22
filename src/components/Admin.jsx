import React, { useState } from 'react';
import { supabase } from '../supabase';
import { ROLES } from '../constants';
import WorkspaceAdmin from './WorkspaceAdmin';

export default function Admin({ users, clients, reload, setNotice }) {
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'design', password: '' });
  const [newClient, setNewClient] = useState('');

  async function toggleUser(user) {
    const action = user.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} o usuário "${user.full_name}"?`)) return;

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'set_active', userId: user.id, active: !user.active }
    });

    if (error || data?.error) {
      setNotice(error?.message || data?.error || 'Não foi possível alterar o usuário.');
      return;
    }

    setNotice(user.active ? 'Usuário desativado com sucesso.' : 'Usuário reativado com sucesso.');
    await reload();
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

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'create',
        email: newUser.email.trim(),
        fullName: newUser.name.trim(),
        role: newUser.role,
        password: newUser.password
      }
    });

    if (error || data?.error) {
      alert(error?.message || data?.error || 'Não foi possível criar o usuário.');
      return;
    }

    alert('Usuário criado com sucesso.');
    setNewUser({ email: '', name: '', role: 'design', password: '' });
    await reload();
  }

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

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Usuários</h2>
        <p className="hint">A criação segura de usuários utiliza uma Edge Function.</p>

        <div className="table">
          {users.map(user => (
            <div className="row" key={user.id}>
              <div className="title">
                <b>{user.full_name}</b>
                <small>{ROLES[user.role] || user.role}</small>
              </div>
              <span className={user.active ? 'badge active' : 'badge inactive'}>
                {user.active ? 'Ativo' : 'Inativo'}
              </span>
              <button
                type="button"
                className={user.active ? 'danger' : 'primary'}
                onClick={() => toggleUser(user)}
              >
                {user.active ? 'Desativar' : 'Reativar'}
              </button>
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
              </div>
            </div>
          ))
        ) : (
          <div className="empty">Nenhum cliente encontrado.</div>
        )}
      </section>

      {/* Áreas de trabalho, cargos e membros (Fase 3) */}
      <WorkspaceAdmin users={users} setNotice={setNotice} />
    </div>
  );
}
