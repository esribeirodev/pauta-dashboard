import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { supabase } from '../supabase';
import { ROLES, CREATIVES, FORWARD_TARGETS } from '../constants';

/*
 * Encaminhar: muda o Responsável Atual.
 * Destino criativo -> in_production (vai trabalhar);
 * destino gestor   -> in_review (vai aprovar).
 */
export default function ForwardModal({ item, role, user, users, close, done }) {
  const creatorIsSelf = item.created_by === user;

  const targets = (users || []).filter(
    candidate =>
      candidate.active &&
      candidate.id !== user &&
      candidate.id !== item.created_by &&
      (FORWARD_TARGETS[role] || []).includes(candidate.role)
  );

  const [mode, setMode] = useState(creatorIsSelf ? 'user' : 'creator');
  const [target, setTarget] = useState('');
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();

    const targetId = mode === 'creator' ? item.created_by : target;
    if (!targetId) {
      alert('Selecione um destinatário.');
      return;
    }

    const person = mode === 'creator'
      ? { role: item.creator?.role }
      : targets.find(candidate => candidate.id === targetId);

    const nextStatus = CREATIVES.includes(person?.role) ? 'in_production' : 'in_review';

    setBusy(true);

    const { error } = await supabase
      .from('content_items')
      .update({
        current_assignee: targetId,
        status: nextStatus,
        submitted_at: new Date().toISOString(),
        /* Destino gestor em aprovação: ele passa a ser o aprovador responsável. */
        ...(nextStatus === 'in_review' ? { current_approver: targetId } : {})
      })
      .eq('id', item.id);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    if (obs.trim()) {
      await supabase.from('content_events').insert({
        content_id: item.id,
        actor_id: user,
        event_type: 'forwarded',
        comment: `Observação do encaminhamento: ${obs.trim()}`
      });
    }

    setBusy(false);
    await done();
  }

  return (
    <div className="overlay">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>Encaminhar demanda</h2>
          <button type="button" className="icon" onClick={close}><X /></button>
        </div>

        {!creatorIsSelf && (
          <div
            className={`option-card ${mode === 'creator' ? 'selected' : ''}`}
            onClick={() => setMode('creator')}
          >
            <input type="radio" readOnly checked={mode === 'creator'} />
            <div>
              <b>Encaminhar para o requisitante</b>
              <p className="hint">{item.creator?.full_name || 'Criador da demanda'}</p>
            </div>
          </div>
        )}

        <div
          className={`option-card ${mode === 'user' ? 'selected' : ''}`}
          onClick={() => setMode('user')}
        >
          <input type="radio" readOnly checked={mode === 'user'} />
          <div style={{ flex: 1 }}>
            <b>Encaminhar para um usuário específico</b>
            {mode === 'user' && (
              <select
                required
                value={target}
                onChange={event => setTarget(event.target.value)}
                style={{ marginTop: 8, width: '100%' }}
              >
                <option value="">Selecione uma pessoa</option>
                {targets.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.full_name} — {ROLES[person.role] || person.role}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <label>
          Observação (opcional)
          <textarea rows="3" value={obs} onChange={event => setObs(event.target.value)} />
        </label>

        <button className="primary wide" disabled={busy}>
          <Send size={16} />
          {busy ? 'Encaminhando…' : 'Encaminhar'}
        </button>
      </form>
    </div>
  );
}
