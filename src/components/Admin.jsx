import React, { useState } from 'react';
import { supabase } from '../supabase';
import { ROLES } from '../constants';

/*
 * supabase.functions.invoke retorna uma mensagem genérica em erros non-2xx.
 * A mensagem real vem no corpo da resposta (error.context).
 */
async function invokeAdmin(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });

  if (error) {
    let message = error.message;
    try {
      const payload = await error.context.json();
      if (payload?.error) message = payload.error;
    } catch {
      /* mantém a mensagem genérica */
    }
    return { error: message };
  }

  if (data?.error) return { error: data.error };
  return { data };
}

export default function Admin({ users, clients, reload, setNotice }) {
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'design', password: '' });
  const [newClient, setNewClient] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function toggleUser(user) {
    const action = user.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} o usuário "${user.full_name}"?`)) return;

    const { error } = await invokeAdmin({ action: 'set_active', userId: user.id, active: !user.active });
    if (error) {
      setNotice(error);
      return;
    }

    setNotice(user.active ? 'Usuário desativado com sucesso.' : 'Usuário reativado com sucesso.');
    await reload();
  }

  async function deleteUser(user) {
    if (!window.confirm(`Excluir DEFINITIVAMENTE o usuário "${user.full_name}"? Essa ação não pode ser desfeita.`)) return;

    const { error } = await invokeAdmin({ action: 'delete', userId: user.id });
    if (error) {
      setNotice(error);
      return;
    }

    setNotice('Usuário excluído com sucesso.');
    await reload();
  }

  function startEdit(user) {
    setEditing({ id: user.id, name: user.full_name || '', role: user.role, password: '' });
  }

  async function saveEdit(event) {
    event.preventDefault();

    if (!editing.name.trim()) {
      setNotice('O nome não pode ficar vazio.');
      return;
    }
    if (editing.password && editing.password.length < 8) {
      setNotice('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setBusy(true);

    const { error } = await invokeAdmin({
      action: 'update_profile',
      userId: editing.id,
      fullName: editing.name.trim(),
      role: editing.role
    });

    if (error) {
      setBusy(false);
      setNotice(error);
      return;
    }

    if (editing.password) {
      const { error: passwordError } = await invokeAdmin({
        action: 'set_password',
        userId: editing.id,
        password: editing.password
      });

      if (passwordError) {
        setBusy(false);
        setNotice(`Perfil salvo, mas a senha não foi alterada: ${passwordError}`);
        setEditing(null);
        await reload();
        return;
      }
    }

    setBusy(false);
    setNotice('Usuário atualizado com sucesso.');
    setEditing(null);
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

    const { error } = await invokeAdmin({
      action: 'create',
      email: newUser.email.trim(),
      fullName: newUser.name.trim(),
      role: newUser.role,
      password: newUser.password
    });

    if (error) {
      alert(error);
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

  async function deleteClient(client) {
    if (!window.confirm(`Excluir DEFINITIVAMENTE o cliente "${client.name}"? Essa ação não pode ser desfeita.`)) return;

    const { error } = await supabase.from('clients').delete().eq('id', client.id);

    if (error) {
      const friendly = error.code === '23503'
        ? 'Este cliente possui demandas vinculadas e não pode ser excluído. Desative-o em vez de excluir.'
        : error.message;
      setNotice(friendly);
      return;
    }

    setNotice('Cliente excluído com sucesso.');
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
        <p className="hint">
          Usuários com histórico (demandas, comentários) não podem ser excluídos — desative-os para bloquear o acesso.
        </p>

        <div className="table">
          {users.map(user => (
            editing?.id === user.id ? (
              <form className="row user-edit" key={user.id} onSubmit={saveEdit}>
                <input
                  required
                  placeholder="Nome completo"
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                />
                <select
                  value={editing.role}
                  onChange={e => setEditing({ ...editing, role: e.target.value })}
                >
                  {Object.entries(ROLES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <input
                  type="password"
                  minLength="8"
                  placeholder="Nova senha (opcional)"
                  autoComplete="new-password"
                  value={editing.password}
                  onChange={e => setEditing({ ...editing, password: e.target.value })}
                />
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? 'Salvando…' : 'Salvar'}
                </button>
                <button type="button" className="secondary" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <div className="row" key={user.id}>
                <div className="title">
                  <b>{user.full_name}</b>
                  <small>{ROLES[user.role] || user.role}</small>
                </div>
                <span className={user.active ? 'badge active' : 'badge inactive'}>
                  {user.active ? 'Ativo' : 'Inativo'}
                </span>
                <button type="button" className="secondary" onClick={() => startEdit(user)}>
                  Editar
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
              </div>
            )
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
                <button className="danger" onClick={() => deleteClient(client)}>
                  Excluir
                </button>
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
