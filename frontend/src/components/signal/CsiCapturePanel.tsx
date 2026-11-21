import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CsiHeatmaps } from '../charts/CsiHeatmaps';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../services/api';
import { CSI_ACTIVITIES, type CsiActivity, type CsiHeatmap } from '../../types/csiCapture';

const PREVIEW_INTERVAL_MS = 1000;

export const CsiCapturePanel = memo(function CsiCapturePanel({ environment, connected, children }: {
  environment: string;
  connected: boolean;
  children?: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [preview, setPreview] = useState<CsiHeatmap | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const pending = useRef(false);
  const load = useCallback((signal: AbortSignal) => api.getCsiCaptures(environment, signal), [environment]);
  const { data, error, loading, refresh } = useApiQuery(load, 0, true);
  const active = data?.active_capture;
  const activeInEnvironment = active?.environment === environment ? active : null;
  const captureId = activeInEnvironment?.id;
  const activeActivity = activeInEnvironment?.activity;

  useEffect(() => {
    if (!active || activeInEnvironment || !data?.as_of) return;
    const remaining = Date.parse(active.ends_at) - Date.parse(data.as_of);
    const timer = window.setTimeout(refresh, Math.max(0, remaining) + 250);
    return () => window.clearTimeout(timer);
  }, [active, activeInEnvironment, data?.as_of, refresh]);

  useEffect(() => {
    setPreview(null);
    setPreviewError(false);
    if (captureId === undefined) return;
    const controller = new AbortController();
    let timer: number | undefined;

    async function update(id: number) {
      try {
        const next = await api.getCsiCapturePreview(id, controller.signal);
        if (controller.signal.aborted) return;
        setPreview(next.heatmap);
        setPreviewError(false);
        if (!next.active) {
          refresh();
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        setPreviewError(true);
      }
      timer = window.setTimeout(() => void update(id), PREVIEW_INTERVAL_MS);
    }

    void update(captureId);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [captureId, refresh]);

  async function toggleCapture(activity: CsiActivity) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setActionError('');
    try {
      if (active) {
        if (activity !== active.activity) return;
        await api.finishCsiCapture(active.id);
      } else {
        await api.startCsiCapture(environment, activity);
      }
      refresh();
    } catch {
      setActionError('No se pudo actualizar la captura CSI.');
      refresh();
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const heatmaps = (data?.heatmaps ?? []).filter(({ capture }) =>
    capture.environment === environment && capture.activity !== activeActivity);
  if (preview && preview.capture.id === captureId) heatmaps.push(preview);

  return (
    <section className="csi-capture-panel">
      {!children && <h3>Amplitud por subportadora</h3>}
      <p>El mapa de la actividad en curso se actualiza en vivo. Los otros muestran la última captura del ambiente.</p>
      {active && <p role="status">Grabando {CSI_ACTIVITIES[active.activity]} en {active.environment}. La captura finaliza a los 5 minutos si no la detenés antes.</p>}
      {!active && !environment && <p className="muted">Ingresá el ambiente para comparar o registrar capturas.</p>}
      {!active && environment && !connected && <p className="muted">Conectá el CSI para iniciar una captura.</p>}
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      {previewError && <p role="status">El mapa en vivo se volverá a actualizar en cuanto responda el servidor.</p>}
      {error && (
        <p role="alert" className="form-error">
          No se pudieron consultar las capturas. <button type="button" className="secondary-button" onClick={refresh}>Reintentar</button>
        </p>
      )}
      {active && !activeInEnvironment && (
        <button type="button" className="secondary-button" disabled={loading || saving}
          onClick={() => void toggleCapture(active.activity)}>
          Finalizar captura de {active.environment}
        </button>
      )}
      <CsiHeatmaps heatmaps={heatmaps} activeActivity={activeActivity} renderControl={(activity) => {
        const isCapturing = activeActivity === activity;
        const label = isCapturing ? 'Finalizar captura' : 'Iniciar captura';
        return (
          <button type="button" className="secondary-button" aria-label={`${label} · ${CSI_ACTIVITIES[activity]}`}
            onClick={() => void toggleCapture(activity)}
            disabled={saving || loading || (!isCapturing && Boolean(active || !environment || !connected || error))}>
            {label}
          </button>
        );
      }}>{children}</CsiHeatmaps>
    </section>
  );
});
