import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Erro inesperado na aplicação.' };
  }

  componentDidCatch(error, info) {
    console.error('Erro de renderização:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="login">
        <div className="login-card">
          <div className="brand dark"><i />PAUTA</div>
          <p className="eyebrow">ERRO AO CARREGAR</p>
          <h1>Ocorreu um erro</h1>
          <p className="sub">A aplicação não conseguiu carregar esta tela.</p>
          <div className="error">{this.state.message}</div>
          <button className="primary wide" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
