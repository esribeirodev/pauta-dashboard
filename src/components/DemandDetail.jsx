import React, { useEffect, useState } from 'react';
import { X, Send, CornerUpLeft, CheckCircle2, PlayCircle, Archive, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { ITEM_SELECT } from '../constants';
import CommentBox from './CommentBox';
import HistoryTimeline from './HistoryTimeline';
import DriveGallery from './DriveGallery';
import DriveUploader from './DriveUploader';

const STATUS_LABEL = {
  received: 'Recebida',
  in_production: 'Em produção',
  in_review: 'Aguardando aprovação final',
  done: 'Concluída',
  archived: 'Arquivada'
};

const local = iso =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const APPROVER_ROLES = ['admin', 'supervisora'];

export default function DemandDetail({ item, user, role, onClose, onChanged, close: closeProp, saved }) {
  const [detail, setDetail] = useState(item);
  const [people, setPeople] = useState([]);
  const [forwardTo, setForwardTo] = useState('');
  const [finalApprover, setFinalApprover] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);

  const isCurrent = detail.current_assignee === user;
  /* Aprovador responsável: quem encaminhou por último para aprovação superior,
     ou o criador da demanda (primeiro aprovador por regra de negócio). */
  const currentApprover = detail.current_approver || detail.created_by;
  const canManageApproval = APPROVER_ROLES.includes(role) || detail.created_by === user;
  const isFinalApproval =
    detail.status === 'in_review' &&
    (APPROVER_ROLES.includes(role) || currentApprover === user);
  const isFinished = detail.status === 'done' || detail.status === 'archived';

  const finalApprovers = people.filter(
    person => APPROVER_ROLES.includes(person.role) && person.id !== user
  );

  function close() {
    const handleClose = onClose || closeProp;
    if (typeof handleClose === 'function') handleClose();
    else console.warn('DemandDetail: prop onClose/close ausente.');
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
      .from('content_items')
      .select(ITEM_SELECT)
      .eq('id', detail.id)
      .single();
    if (data) setDetail(data);
    setTimelineKey(key => key + 1);
    const handleChanged = onChanged || saved;
    if (handleChanged) await handleChanged();
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

  async function logEvent(eventType, comment) {
    const { error } = await supabase.from('content_events').insert({
      content_id: detail.id,
      actor_id: user,
      event_type: eventType,
      comment: comment || null
    });
    if (error) throw error;
  }

  async function updateStatus(patch, eventType, comment) {
    setBusy(true);
    const { error } = await supabase.from('content_items').update(patch).eq('id', detail.id);
    if (error) {
      setBusy(false);
      alert(error.message);
      return;
    }
    try {
      await logEvent(eventType, comment);
    } catch (eventError) {
      console.error(eventError);
      alert(`A demanda foi atualizada, mas o histórico não foi registrado: ${eventError.message}`);
    }
    setActionNote('');
    setForwardTo('');
    setFinalApprover('');
    setBusy(false);
    await reload();
  }

  /*
   * Exclusão (somente admin): soft delete via deleted_at.
   * A demanda some das listas de todos, mas o histórico é preservado
   * e a policy de SELECT do admin ainda permite auditoria.
   */
  async function deleteDemand() {
    if (!window.confirm(`Excluir a demanda "${detail.title}"? Ela sairá das listas de todos os usuários.`)) return;

    setBusy(true);

    try {
      await logEvent('archive', 'Demanda excluída pelo administrador.');
    } catch (eventError) {
      console.error(eventError);
    }

    const { error } = await supabase
      .from('content_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', detail.id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    const handleChanged = onChanged || saved;
    if (handleChanged) await handleChanged();
    close();
  }

  const startProduction = () =>
    updateStatus({ status: 'in_production' }, 'start', 'Iniciou a produção.');

  const sendToReview = () =>
    updateStatus(
      { status: 'in_review', current_assignee: currentApprover },
      'to_review',
      actionNote || 'Enviou para aprovação.'
    );

  const forward = () => {
    if (!forwardTo) return alert('Escolha para quem encaminhar.');
    const target = people.find(person => person.id === forwardTo);
    updateStatus(
      { current_assignee: forwardTo, status: 'received' },
      'forward',
      actionNote || `Encaminhou para ${target?.full_name || 'outro membro'}.`
    );
  };

  const returnDemand = () => {
    if (!actionNote.trim()) return alert('Descreva o motivo da devolução.');
    updateStatus({ current_assignee: detail.created_by, status: 'received' }, 'return', actionNote);
  };

  const approveFinal = () =>
    updateStatus(
      { status: 'done' },
      'approve',
      actionNote || 'Aprovação final registrada. Demanda concluída.'
    );

  const requestChanges = async () => {
    if (!actionNote.trim()) return alert('Descreva os ajustes necessários.');

    let backTo = detail.created_by;
    const { data: lastReview } = await supabase
      .from('content_events')
      .select('actor_id')
      .eq('content_id', detail.id)
      .eq('event_type', 'to_review')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastReview?.actor_id) backTo = lastReview.actor_id;

    updateStatus(
      { status: 'in_production', current_assignee: backTo, current_approver: user },
      'request_changes',
      actionNote
    );
  };

  const sendToFinalReview = () => {
    if (!finalApprover) return alert('Escolha quem fará a aprovação final.');
    const target = people.find(person => person.id === finalApprover);
    updateStatus(
      { current_assignee: finalApprover, current_approver: finalApprover },
      'first_approval',
      actionNote
        ? `Primeira aprovação registrada. Enviado para aprovação final de ${target?.full_name || 'gestor(a)'}. ${actionNote}`
        : `Primeira aprovação registrada. Enviado para aprovação final de ${target?.full_name || 'gestor(a)'}.`
    );
  };

  const archive = () =>
    updateStatus({ status: 'archived' }, 'archive', 'Demanda arquivada.');

  return (
    <div className="overlay" onClick={event => event.target === event.currentTarget && close()}>
      <div className="modal" style={{ width: 'min(640px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{detail.content_type || 'Demanda'}</p>
            <h2>{detail.title}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Fechar" onClick={event => { event.stopPropagation(); close(); }}>
            <X size={17} />
          </button>
        </div>

        <div className="detail-grid">
          <div><b>Status</b><p><span className={`status ${detail.status}`}>{STATUS_LABEL[detail.status] || detail.status}</span>{detail.priority && <span className={`priority ${detail.priority}`} style={{ marginLeft: 6 }}>{detail.priority}</span>}</p></div>
          <div><b>Criada por</b><p>{detail.creator?.full_name || '—'}</p></div>
          <div><b>Prazo</b><p>{local(detail.due_at)}</p></div>
          <div><b>Responsável atual</b><p>{detail.assignee?.full_name || '—'}</p></div>
        </div>

        {detail.briefing && <div className="briefing"><b>Briefing</b><p style={{ margin: '6px 0 0' }}>{detail.briefing}</p></div>}

        <DriveGallery item={detail} />
        {isCurrent && !isFinished && <DriveUploader item={detail} onDone={reload} />}

        {!isFinished && (isCurrent || canManageApproval) && (
          <>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 12, margin: '13px 0 0' }}>
              Observação da ação (obrigatória para enviar, aprovar, devolver ou pedir ajustes)
              <textarea rows="2" value={actionNote} onChange={event => setActionNote(event.target.value)} placeholder="Contexto para a próxima pessoa…" />
            </label>

            <div className="action-bar">
              {detail.status === 'received' && isCurrent && <button type="button" className="primary" disabled={busy} onClick={startProduction}><PlayCircle size={15} /> Iniciar produção</button>}

              {detail.status === 'in_production' && isCurrent && <button type="button" className="primary" disabled={busy || !actionNote.trim()} onClick={sendToReview}><Send size={15} /> Enviar para aprovação</button>}

              {detail.status === 'in_review' && isFinalApproval && <>
                <button type="button" className="primary" disabled={busy || !actionNote.trim()} onClick={approveFinal}><CheckCircle2 size={15} /> Aprovar e concluir</button>
                <button type="button" className="secondary" disabled={busy || !actionNote.trim()} onClick={requestChanges}><CornerUpLeft size={15} /> Pedir ajustes</button>
              </>}

              {isCurrent && detail.status !== 'in_review' && <>
                <select value={forwardTo} onChange={event => setForwardTo(event.target.value)}><option value="">Encaminhar para…</option>{people.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select>
                <button type="button" className="secondary" disabled={busy || !forwardTo} onClick={forward}><Send size={15} /> Encaminhar</button>
                <button type="button" className="danger" disabled={busy || !actionNote.trim()} onClick={returnDemand}><CornerUpLeft size={15} /> Devolver</button>
              </>}

              {isCurrent && detail.status === 'in_review' && currentApprover === user && finalApprovers.length > 0 && <>
                <select value={finalApprover} onChange={event => setFinalApprover(event.target.value)}><option value="">Escolha a segunda pessoa…</option>{finalApprovers.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select>
                <button type="button" className="secondary" disabled={busy || !finalApprover || !actionNote.trim()} onClick={sendToFinalReview}><ShieldCheck size={15} /> Registrar 1ª aprovação e enviar</button>
              </>}

              {(role === 'admin' || role === 'supervisora') && detail.status === 'done' && <button type="button" className="secondary" disabled={busy} onClick={archive}><Archive size={15} /> Arquivar</button>}
            </div>
          </>
        )}

        {role === 'admin' && (
          <div className="action-bar" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="danger" disabled={busy} onClick={deleteDemand}>
              <Trash2 size={15} /> Excluir demanda
            </button>
          </div>
        )}

        {isCurrent && !isFinished && <CommentBox contentId={detail.id} user={user} onPosted={() => setTimelineKey(key => key + 1)} />}
        <HistoryTimeline contentId={detail.id} refresh={timelineKey} />
      </div>
    </div>
  );
}
