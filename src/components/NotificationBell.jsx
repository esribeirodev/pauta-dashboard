import React, { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '../supabase';

const local = iso =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

/*
 * v4 — dropdown viewport-aware + 3 formas de fechar:
 *   botão ✕, tecla Esc e clique fora (e o próprio sino faz toggle).
 *
 * AJUSTE AQUI se sua tabela usar outros nomes:
 */
const TABLE = 'notifications';
const COLS = { user: 'user_id', msg: 'message', read: 'read_at', created: 'created_at' };

const PANEL_WIDTH = 330;
const MARGIN = 12;

export default function NotificationBell({ user, onOpenContent }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 76, left: MARGIN, width: PANEL_WIDTH });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  async function load() {
    const { data } = await supabase
      .from(TABLE)
      .select('*')
      .eq(COLS.user, user)
      .order(COLS.created, { ascending: false })
      .limit(20);
    setItems(data || []);
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [user]);

  function computePosition() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(PANEL_WIDTH, window.innerWidth - MARGIN * 2);
    let left = rect.right - width; /* preferência: alinhar à direita do sino */
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));

    setPos({ top: rect.bottom + 8, left, width });
  }

  function toggle() {
    if (!open) computePosition();
    setOpen(previous => !previous);
  }

  useEffect(() => {
    if (!open) return;

    function onClickOutside(event) {
      if (
        panelRef.current && !panelRef.current.contains(event.target) &&
        btnRef.current && !btnRef.current.contains(event.target)
      ) setOpen(false);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('resize', computePosition);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('resize', computePosition);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unread = items.filter(notification => !notification[COLS.read]).length;

  async function markAll() {
    await supabase
      .from(TABLE)
      .update({ [COLS.read]: new Date().toISOString() })
      .eq(COLS.user, user)
      .is(COLS.read, null);
    await load();
  }

  async function clickItem(notification) {
    if (!notification[COLS.read]) {
      await supabase
        .from(TABLE)
        .update({ [COLS.read]: new Date().toISOString() })
        .eq('id', notification.id);
      await load();
    }
    if (notification.content_id && onOpenContent) {
      setOpen(false);
      onOpenContent(notification.content_id);
    }
  }

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="icon notif-btn"
        onClick={toggle}
        aria-label="Notificações"
      >
        <Bell />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="notif-dropdown"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="notif-head">
            <b>Notificações</b>
            <span className="notif-head-actions">
              {unread > 0 && (
                <button type="button" className="linklike" onClick={markAll}>
                  Marcar todas como lidas
                </button>
              )}
              <button
                type="button"
                className="notif-close"
                onClick={() => setOpen(false)}
                aria-label="Fechar notificações"
              >
                <X size={15} />
              </button>
            </span>
          </div>

          {items.length === 0 && (
            <p className="hint" style={{ padding: 14, textAlign: 'center' }}>
              Nenhuma notificação.
            </p>
          )}

          {items.map(notification => (
            <div
              key={notification.id}
              className={`notif-item ${notification[COLS.read] ? '' : 'unread'}`}
              onClick={() => clickItem(notification)}
            >
              <p>{notification[COLS.msg]}</p>
              <small>{local(notification[COLS.created])}</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
