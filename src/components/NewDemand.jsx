import React, { useState } from 'react';
import { X, Paperclip } from 'lucide-react';
import { supabase } from '../supabase';
import { ROLES, CREATIVES, TYPE, PRIORITY } from '../constants';

/*
 * Admin: atribui a QUALQUER usuário ativo (inclusive gestores).
 * Demais gestores: atribuem apenas a criativos.
 * Área de trabalho: usa a selecionada no header; com 2+ áreas visíveis
 * o usuário pode trocar aqui. Se vier vazia, o trigger do banco resolve.
 */
export default function NewDemand({
  users, clients, clientId, creator, role,
  workspaces = [], workspaceId = '',
  close, saved
}) {
  const isAdmin = role === 'admin';
  const multiArea = workspaces.length > 1;

  const [form, setForm] = useState({
    title: '',
    type: 'CARD',
    briefing: '',
    due: '',
    priority: 'media',
    area: 'design',
    assignee: '',
    clientId: clientId || '',
    workspaceId: workspaceId || workspaces[0]?.id || ''
  });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const activeUsers = Array.isArray(users)
    ? users.filter(user => user && user.active === true)
    : [];

  const areas = isAdmin ? Object.keys(ROLES) : CREATIVES;

  const candidates = activeUsers.filter(
    user => user.role === form.area && user.id !== creator
  );

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit(event) {
    event.preventDefault();

    if (!form.clientId) { alert('Selecione um cliente.'); return; }
    if (!form.assignee) { alert('Selecione um responsável.'); return; }

    setBusy(true);

    const { data, error } = await supabase
      .from('content_items')
      .insert({
        client_id: form.clientId,
        title: form.title,
        content_type: form.type,
        briefing: form.briefing,
        due_at: form.due || null,
        priority: form.priority,
        created_by: creator,
        status: 'received',
        workspace_id: form.workspaceId || null
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    const { error: assignmentError } = await supabase
      .from('content_assignments')
      .insert({
        content_id: data.id,
        department: form.area,
        assigned_to: form.assignee,
        assigned_by: creator
      });

    if (assignmentError) {
      alert(assignmentError.message);
      setBusy(false);
      return;
    }

    for (const file of files) {
      const path = `${data.id}/${crypto.randomUUID()}-${file.name}`;
      const upload = await supabase.storage.from('media').upload(path, file);

      if (!upload.error) {
        await supabase.from('content_attachments').insert({
          content_id: data.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: creator
        });
      }
    }

    setBusy(false);
    await saved();
  }

  return (
    <div className="overlay">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>Nova demanda</h2>
          <button type="button" className="icon" onClick={close}><X /></button>
        </div>

        {multiArea && (
          <label>
            Área de trabalho
            <select
              required
              value={form.workspaceId}
              onChange={e => set('workspaceId', e.target.value)}
            >
              {workspaces.map(ws => (
                <option value={ws.id} key={ws.id}>{ws.name}</option>
              ))}
            </select>
          </label>
        )}

        <label>
          Cliente
          <select required value={form.clientId} onChange={e => set('clientId', e.target.value)}>
            <option value="">Selecione um cliente</option>
            {clients.map(client => (
              <option value={client.id} key={client.id}>{client.name}</option>
            ))}
          </select>
        </label>

        <label>
          Título
          <input required value={form.title} onChange={e => set('title', e.target.value)} />
        </label>

        <div className="form-grid">
          <label>
            Tipo
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {TYPE.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>

          <label>
            Prazo
            <input
              required
              type="datetime-local"
              value={form.due}
              onChange={e => set('due', e.target.value)}
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Prioridade
            <select value={form.priority} onChange={e => set('priority', e.target.value)}>
              {Object.entries(PRIORITY).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            {isAdmin ? 'Área / cargo' : 'Área criativa'}
            <select
              required
              value={form.area}
              onChange={e => setForm(prev => ({ ...prev, area: e.target.value, assignee: '' }))}
            >
              {areas.map(area => (
                <option key={area} value={area}>{ROLES[area]}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Responsável
          <select required value={form.assignee} onChange={e => set('assignee', e.target.value)}>
            <option value="">Selecione uma pessoa</option>
            {candidates.map(user => (
              <option key={user.id} value={user.id}>
                {user.full_name} — {ROLES[user.role]}
              </option>
            ))}
          </select>
        </label>

        {!candidates.length && (
          <p className="hint">Nenhum usuário ativo encontrado para esta área.</p>
        )}

        <label>
          Briefing
          <textarea rows="6" value={form.briefing} onChange={e => set('briefing', e.target.value)} />
        </label>

        <label>
          <Paperclip size={15} /> Imagens/anexos
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={e => setFiles([...e.target.files])}
          />
        </label>

        <p className="hint">Vídeos devem ser enviados como link (Drive, WeTransfer etc.) na demanda.</p>

        <button disabled={busy || !candidates.length} className="primary wide">
          {busy ? 'Salvando…' : 'Criar e atribuir demanda'}
        </button>
      </form>
    </div>
  );
}
