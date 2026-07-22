import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../supabase';

export default function CommentBox({ contentId, user, onPosted }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function post() {
    const message = text.trim();
    if (!message) return;

    setBusy(true);
    const { error } = await supabase.from('content_events').insert({
      content_id: contentId,
      actor_id: user,
      event_type: 'comment',
      comment: message
    });
    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }
    setText('');
    if (onPosted) onPosted();
  }

  return (
    <div className="comment-box">
      <label style={{ display: 'block', fontWeight: 700, fontSize: 12 }}>
        <MessageSquare size={15} style={{ verticalAlign: '-3px', marginRight: 5 }} />
        Resposta / atualização
        <textarea
          rows="3"
          value={text}
          maxLength={2000}
          placeholder="Escreva uma resposta sobre a demanda (visível no histórico para todos os envolvidos)…"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) post();
          }}
        />
      </label>
      <div className="comment-actions">
        <small className="hint">{text.length}/2000 · Ctrl+Enter envia</small>
        <button type="button" className="secondary" disabled={busy || !text.trim()} onClick={post}>
          {busy ? 'Enviando…' : 'Enviar resposta'}
        </button>
      </div>
    </div>
  );
}
