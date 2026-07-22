import React, { useEffect, useRef, useState } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { supabase } from '../supabase';

const STATUS_LABEL = {
  received: 'Recebida',
  in_production: 'Em produção',
  in_review: 'Em aprovação',
  done: 'Concluída',
  archived: 'Arquivada'
};

const local = iso =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

/*
 * Busca global de demandas (estilo Cmd+K).
 * Props:
 *   clientId  — opcional; se vier, restringe ao cliente atual
 *   onOpen(id) — chamado ao escolher uma demanda
 *   onClose()
 */
export default function SearchOverlay({ clientId, onOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  /* Esc fecha; setas navegam; Enter abre */
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      if (event.key === 'Enter' && results[cursor]) onOpen(results[cursor].id);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [results, cursor, onClose, onOpen]);

  /* Busca com debounce de 300ms em título + briefing */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      let request = supabase
        .from('content_items')
        .select('id, title, status, priority, due_at, assignee:profiles!current_assignee(full_name)')
        .or(`title.ilike.%${term}%,briefing.ilike.%${term}%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(12);
      if (clientId) request = request.eq('client_id', clientId);

      const { data, error } = await request;
      if (error) console.error('Busca:', error);
      setResults(data || []);
      setCursor(0);
      setLoading(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, clientId]);

  return (
    <div className="overlay search-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="search-panel">
        <div className="search-input-row">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Buscar demandas por título ou briefing…"
            onChange={event => setQuery(event.target.value)}
          />
          <button type="button" className="modal-close" aria-label="Fechar" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {loading && <p className="hint" style={{ padding: 12 }}>Buscando…</p>}

        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <p className="hint" style={{ padding: 14, textAlign: 'center' }}>
            Nenhuma demanda encontrada para “{query.trim()}”.
          </p>
        )}

        {!loading && query.trim().length < 2 && (
          <p className="hint" style={{ padding: 14, textAlign: 'center' }}>
            Digite pelo menos 2 letras. Dica: Ctrl+K abre a busca de qualquer lugar.
          </p>
        )}

        {results.map((demand, index) => (
          <div
            key={demand.id}
            className={`search-item ${index === cursor ? 'active' : ''}`}
            onMouseEnter={() => setCursor(index)}
            onClick={() => onOpen(demand.id)}
          >
            <div className="search-item-main">
              <b>{demand.title}</b>
              <small>
                {demand.assignee?.full_name || 'Sem responsável'} · prazo {local(demand.due_at)}
              </small>
            </div>
            <span className="search-item-side">
              <span className={`status ${demand.status}`}>{STATUS_LABEL[demand.status] || demand.status}</span>
              {index === cursor && <CornerDownLeft size={13} className="hint-enter" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
