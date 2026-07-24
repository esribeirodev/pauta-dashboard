import React, { useEffect, useState } from 'react';
import { X, CornerUpLeft } from 'lucide-react';
import { supabase } from '../supabase';
import { ROLES, CREATIVES } from '../constants';

/*
 * Devolver: observação OBRIGATÓRIA + dois caminhos:
 * 1) Devolver para o criador (um clique);
 * 2) Devolver para um participante específico da demanda.
 * O seletor lista APENAS quem já participou (get_content_participants).
 * Regra de status: devolveu para criativo -> in_production;
 * devolveu para gestor -> received (devolução NÃO é pedido de aprovação).
 */
export default function ReturnModal({ item, user, close, done }) {
  const [participants, setParticipants] = useState([]);
  const [target, setTarget] = useState('');
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .rpc('get_content_participants', { p_content_id: item.id })
      .then(({ data, error }) => {
        if (error) {
          console.error('Erro ao carregar participantes:', error);
          return;
        }
        setParticipants((data || []).filter(person => person.id !== user));
      });
  }, [item.id, user]);

  const creator = participants.find(person => person.id === item.created_by);

  async function returnTo(targetId) {
    if (!obs.trim()) {
      alert('Descreva o motivo da devolução (obrigatório).');
      return;
    }

    const person = participants.find(candidate => candidate.id === targetId);
    if (!person) {
      alert('Selecione um destinatário válido.');
      return;
    }

    setBusy(true);

    const nextStatus = CREATIVES.includes(person.role) ? 'in_production' : 'received';

    const { error } = await supabase
      .from('content_items')
      .update({ current_assignee: person.id, status: nextStatus })
      .eq('id', item.id);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    await supabase.from('content_events').insert({
      content_id: item.id,
      actor_id: user,
      event_type: 'returned',
      comment: `Devolvida para ${person.full_name}. Motivo: ${obs.trim()}`
    });

    setBusy(false);
    await done();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head">
          <h2>Devolver demanda</h2>
          <button type="button" className="icon" onClick={close}><X /></button>
        </div>

        <label>
          Motivo da devolução (obrigatório)
          <textarea
            rows="4"
            value={obs}
            onChange={event => setObs(event.target.value)}
            placeholder="Explique o que precisa ser ajustado…"
          />
        </label>

        {creator && (
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => returnTo(creator.id)}
          >
            <CornerUpLeft size={16} />
            Devolver para o criador ({creator.full_name})
          </button>
        )}

        <label style={{ marginTop: 16 }}>
          Ou devolver para um participante
          <select value={target} onChange={event => setTarget(event.target.value)}>
            <option value="">Selecione um participante</option>
            {participants.map(person => (
              <option key={person.id} value={person.id}>
                {person.full_name} — {ROLES[person.role] || person.role}
              </option>
            ))}
          </select>
        </label>

        <button
          className="secondary wide"
          disabled={busy || !target}
          onClick={() => returnTo(target)}
        >
          Devolver para selecionado
        </button>

        <p className="hint">
          Somente usuários que já participaram desta demanda podem recebê-la de volta.
        </p>
      </div>
    </div>
  );
}
