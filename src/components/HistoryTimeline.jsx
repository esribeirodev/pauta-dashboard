import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const local = iso =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

const EVENT_LABEL = {
  create: 'Criou a demanda',
  start: 'Iniciou a produção',
  forward: 'Encaminhou',
  return: 'Devolveu',
  to_review: 'Enviou para aprovação',
  approve: 'Aprovou',
  request_changes: 'Pediu ajustes',
  archive: 'Arquivou',
  comment: 'Comentou'
};

export default function HistoryTimeline({ contentId, refresh = 0 }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    supabase
      .from('content_events')
      .select('*, actor:profiles!actor_id(full_name, role)')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Erro ao carregar histórico:', error);
        setEvents(data || []);
      });
  }, [contentId, refresh]);

  if (events === null) {
    return (
      <div className="timeline">
        <h3>Histórico</h3>
        <p className="hint">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      <h3>Histórico ({events.length})</h3>
      {events.map(event => (
        <div
          className={`event ${event.event_type === 'comment' ? 'is-comment' : ''}`}
          key={event.id}
        >
          {event.event_type === 'comment' && <span className="event-tag">💬 Resposta</span>}
          {event.comment || EVENT_LABEL[event.event_type] || event.event_type}
          <small>
            {event.actor?.full_name || '—'}
            {event.actor?.role ? ` (${event.actor.role})` : ''}
            {' · '}{local(event.created_at)}
          </small>
        </div>
      ))}
      {!events.length && <p className="hint">Nenhum evento registrado.</p>}
    </div>
  );
}
