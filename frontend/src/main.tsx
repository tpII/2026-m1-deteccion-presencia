import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ScreenErrorBoundary } from './components/ui/ScreenErrorBoundary';
import './styles/global.css';

function Dashboard() {
  useEffect(() => {
    document.getElementById('app-startup')?.remove();
  }, []);

  return <ScreenErrorBoundary><App /></ScreenErrorBoundary>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>
);
