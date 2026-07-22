import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) setError(loginError.message);
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="brand dark"><i />PAUTA</div>
        <p className="eyebrow">ACESSO DA EQUIPE</p>
        <h1>Bem-vindo de volta</h1>
        <label>
          E-mail
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary wide">Entrar</button>
      </form>
    </div>
  );
}
