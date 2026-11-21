const startupStatus = document.getElementById('app-startup-status');

function showStartupFailure() {
  if (startupStatus?.isConnected) {
    startupStatus.textContent = 'El panel no pudo terminar de cargar. Volvé a cargar para reintentar.';
  }
}

const startupTimeout = window.setTimeout(showStartupFailure, 10000);
void import('./main').catch((error: unknown) => {
  window.clearTimeout(startupTimeout);
  showStartupFailure();
  console.error('Error al iniciar el panel de PIR y CSI:', error);
});
