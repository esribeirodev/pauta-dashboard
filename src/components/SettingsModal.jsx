import React, { useEffect, useState } from 'react';
import { X, User, KeyRound, Save } from 'lucide-react';
import { supabase } from '../supabase';

const ROLE_LABEL = {
  admin: 'Administrador',
  supervisora: 'Supervisora',
  midia: 'Mídia',
  design: 'Design',
  filmmaker: 'Filmmaker',
  redator: 'Redator'
};

/*
 * Configurações do usuário — sem mudança de banco.
 * - editar nome de exibição (profiles.full_name)
 * - trocar senha (Supabase Auth)
 * Props: user (id do usuário logado), onClose(), onSaved() opcional
 */
export default function SettingsModal({ user, onClose, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user)
      .single()
      .then(async ({ data }) => {
        const { data: auth } = await supabase.auth.getUser();
        setProfile({ ...data, email: auth?.user?.email || '' });
        setName(data?.full_name || '');
      });
  }, [user]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function save() {
    setMessage(null);

    if (!name.trim()) return setMessage({ type: 'error', text: 'O nome não pode ficar vazio.' });
    if (password && password.length < 6) return setMessage({ type: 'error', text: 'A senha precisa de pelo menos 6 caracteres.' });
    if (password && password !== password2) return setMessage({ type: 'error', text: 'As senhas não conferem.' });

    setBusy(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', user);

    let authError = null;
    if (password) {
      const { error } = await supabase.auth.updateUser({ password });
      authError = error;
    }

    setBusy(false);

    if (profileError || authError) {
      setMessage({ type: 'error', text: (profileError || authError).message });
      return;
    }

    setPassword('');
    setPassword2('');
    setMessage({ type: 'ok', text: 'Alterações salvas!' });
    if (onSaved) onSaved();
  }

  if (!profile) return null;

  return (
    <div className="overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(460px,100%)' }}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Configurações</p>
            <h2>Minha conta</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Fechar" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <div className="settings-info">
          <p><b>E-mail:</b> {profile.email}</p>
          <p><b>Cargo:</b> {ROLE_LABEL[profile.role] || profile.role}</p>
        </div>

        <label>
          <User size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          Nome de exibição
          <input value={name} maxLength={80} onChange={event => setName(event.target.value)} />
        </label>

        <label>
          <KeyRound size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          Nova senha (deixe em branco para manter a atual)
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={event => setPassword(event.target.value)}
          />
        </label>

        {password && (
          <label>
            Confirmar nova senha
            <input
              type="password"
              value={password2}
              autoComplete="new-password"
              onChange={event => setPassword2(event.target.value)}
            />
          </label>
        )}

        {message && (
          <p className={message.type === 'error' ? 'error' : 'success-note'}>{message.text}</p>
        )}

        <button type="button" className="primary wide" disabled={busy} onClick={save} style={{ marginTop: 14 }}>
          <Save size={15} /> {busy ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
