import { Component, type ReactNode } from 'react';

interface ScreenErrorBoundaryProps {
  children: ReactNode;
}

export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="glass-panel page-stack" role="alert">
        <h2>Esta pantalla no pudo cargarse</h2>
        <p>Podés reintentar desde acá o volver al inicio.</p>
        <div className="live-trial-buttons">
          <button type="button" className="secondary-button" onClick={() => this.setState({ failed: false })}>
            Reintentar pantalla
          </button>
          <a className="secondary-button" href="/">Volver al inicio</a>
        </div>
      </div>
    );
  }
}
