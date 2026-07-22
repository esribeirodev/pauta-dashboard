import React, { useEffect, useState } from 'react';
import { X, Send, CornerUpLeft, CheckCircle2, PlayCircle, Archive } from 'lucide-react';
import { supabase } from '../supabase';
import CommentBox from './CommentBox';
import HistoryTimeline from './HistoryTimeline';
import DriveGallery from './DriveGallery';     /* AJUSTE AQUI se o nome for outro */
import DriveUploader from './DriveUploader';   /* AJUSTE AQUI se o nome for outro */

const STATUS_LABEL = {
  received: 'Recebida',
  in_production: 'Em produção',
  in_review: 'Em aprovação',
  done: 'Concluída',
  archived: 'Arquivada'
};

const local = iso =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function DemandDetail({ item, user, role, onClose, onChanged, close: closeProp, saved }) {
  const [detail, setDetail] = useState(item);
  const [people, setPeople] = useState([]);
  const [forwardTo, setForwardTo] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);

  const isCurrent = detail.assignee_id === user;
  const isAdmin = role === 'admin' || role === 'supervisora';
  const isFinished = detail.status === 'done' || detail.status === 'archived';

  /* Fechamento robusto: aviso se a prop faltar + Esc fecha */
  function close() {
    const handleClose = onClose || closeProp;
    if (typeof handleClose === 'function') handleClose();
    else console.warn('DemandDetail: prop onClose/close ausente — verifique como o componente é chamado no pai.');
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  async function reload() {
    const { data } = await supabase
      .from('contents')
      .select('*, creator:profiles!created_by(full_name), assignee:profiles!assignee_id(full_name)')
      .eq('id', detail.id)
      .single();
    if (data) setDetail(data);
    setTimelineKey(key => key + 1);
    const handleChanged = onChanged || saved;
    if (handleChanged) handleChanged();
  }

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('active', true)
      .neq('id', user)
      .order('full_name')
      .then(({ data }) => setPeople(data || []));
  }, [user]);

  async function logEvent(eventType, comment, notifyUserId, notifyMessage) {
    await supabase.from('content_events').insert({
      content_id: detail.id,
      actor_id: user,
      event_type: eventType,
      comment: comment || null
    });
    if (notifyUserId) {
      await supabase.from('notifications').insert({
        user_id: notifyUserId,
        content_id: detail.id,
        message: notifyMessage
      });
    }
  }

  async function updateStatus(patch, eventType, comment, notifyUserId, notifyMessage) {
    setBusy(true);
    const { error } = await supabase.from('contents').update(patch).eq('id', detail.id);
    if (error) {
      setBusy(false);
      alert(error.message);
      return;
    }
    await logEvent(eventType, comment, notifyUserId, notifyMessage);
    setActionNote('');
    setForwardTo('');
    setBusy(false);
    await reload();
  }

  const startProduction = () =>
    updateStatus({ status: 'in_production' }, 'start', 'Iniciou a produção.');

  const sendToReview = () =>
    updateStatus(
      { status: 'in_review' },
      'to_review',
      actionNote || 'Enviou para aprovação.',
      detail.created_by !== user ? detail.created_by : null,
      `"${detail.title}" foi enviada para aprovação.`
    );

  const forward = () => {
    if (!forwardTo) return alert('Escolha para quem encaminhar.');
    const target = people.find(person => person.id === forwardTo);
    updateStatus(
      { assignee_id: forwardTo, status: 'received' },
      'forward',
      actionNote || `Encaminhou para ${target?.full_name || 'outro membro'}.`,
      forwardTo,
      `A demanda "${detail.title}" agora está sob sua responsabilidade.`
    );
  };

  const returnDemand = () => {
    if (!actionNote.trim()) return alert('Descreva o motivo da devolução.');
    updateStatus(
      { assignee_id: detail.created_by, status: 'received' },
      'return',
      actionNote,
      detail.created_by !== user ? detail.created_by : null,
      `"${detail.title}" foi devolvida: ${actionNote.slice(0, 120)}`
    );
  };

  const approve = () =>
    updateStatus(
      { status: 'done' },
      'approve',
      actionNote || 'Demanda aprovada e concluída.',
      detail.assignee_id !== user ? detail.assignee_id : null,
      `"${detail.title}" foi aprovada. 🎉`
    );

  const requestChanges = () => {
    if (!actionNote.trim()) return alert('Descreva os ajustes necessários.');
    updateStatus(
      { status: 'in_production' },
      'request_changes',
      actionNote,
      detail.assignee_id !== user ? detail.assignee_id : null,
      `"${detail.title}" precisa de ajustes: ${actionNote.slice(0, 120)}`
    );
  };

  const archive = () =>
    updateStatus({ status: 'archived' }, 'archive', 'Demanda arquivada.');

  return (
    <div className="overlay" onClick={event => event.target === event.currentTarget && close()}>
      <div className="modal" style={{ width: 'min(640px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{detail.format || 'Demanda'}</p>
            <h2>{detail.title}</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Fechar"
            onClick={event => { event.stopPropagation(); close(); }}
          >
            <X size={17} />
          </button>
        </div>

        <div className="detail-grid">
          <div>
            <b>Status</b>
            <p>
              <span className={`status ${detail.status}`}>{STATUS_LABEL[detail.status] || detail.status}</span>
              {detail.priority && <span className={`priority ${detail.priority}`} style={{ marginLeft: 6 }}>{detail.priority}</span>}
            </p>
          </div>
          <div><b>Criada por</b><p>{detail.creator?.full_name || '—'}</p></div>
          <div><b>Prazo</b><p>{local(detail.deadline)}</p></div>
          <div><b>Responsável atual</b><p>{detail.assignee?.full_name || '—'}</p></div>
        </div>

        {detail.briefing && (
          <div className="briefing">
            <b>Briefing</b>
            <p style={{ margin: '6px 0 0' }}>{detail.briefing}</p>
          </div>
        )}

        <DriveGallery item={detail} />
        {isCurrent && !isFinished && (
          <DriveUploader contentId={detail.id} folderId={detail.drive_folder_id} onUploaded={reload} />
        )}

        {!isFinished && (isCurrent || isAdmin) && (
          <>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 12, margin: '13px 0 0' }}>
              Observação da ação (opcional para encaminhar/aprovar, obrigatória para devolver/pedir ajustes)
              <textarea
                rows="2"
                value={actionNote}
                onChange={event => setActionNote(event.target.value)}
                placeholder="Contexto para a próxima pessoa…"
              />
            </label>

            <div className="action-bar">
              {detail.status === 'received' && isCurrent && (
                <button type="button" className="primary" disabled={busy} onClick={startProduction}>
                  <PlayCircle size={15} /> Iniciar produção
                </button>
              )}

              {detail.status === 'in_production' && isCurrent && (
                <button type="button" className="primary" disabled={busy} onClick={sendToReview}>
                  <Send size={15} /> Enviar para aprovação
                </button>
              )}

              {detail.status === 'in_review' && (isAdmin || detail.created_by === user) && (
                <>
                  <button type="button" className="primary" disabled={busy} onClick={approve}>
                    <CheckCircle2 size={15} /> Aprovar
                  </button>
                  <button type="button" className="secondary" disabled={busy} onClick={requestChanges}>
                    <CornerUpLeft size={15} /> Pedir ajustes
                  </button>
                </>
              )}

              {isCurrent && detail.status !== 'in_review' && (
                <>
                  <select value={forwardTo} onChange={event => setForwardTo(event.target.value)}>
                    <option value="">Encaminhar para…</option>
                    {people.map(person => (
                      <option key={person.id} value={person.id}>{person.full_name}</option>
                    ))}
                  </select>
                  <button type="button" className="secondary" disabled={busy || !forwardTo} onClick={forward}>
                    <Send size={15} /> Encaminhar
                  </button>
                  <button type="button" className="danger" disabled={busy} onClick={returnDemand}>
                    <CornerUpLeft size={15} /> Devolver
                  </button>
                </>
              )}

              {isAdmin && detail.status === 'done' && (
                <button type="button" className="secondary" disabled={busy} onClick={archive}>
                  <Archive size={15} /> Arquivar
                </button>
              )}
            </div>
          </>
        )}

        {isCurrent && !isFinished && (
          <CommentBox
            contentId={detail.id}
            user={user}
            onPosted={() => setTimelineKey(key => key + 1)}
          />
        )}

        <HistoryTimeline contentId={detail.id} refresh={timelineKey} />
      </div>
    </div>
  );
}
