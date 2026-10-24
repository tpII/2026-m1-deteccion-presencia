import { useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { SectionHeader } from '../ui/SectionHeader';
import { CASE_LABELS } from '../../config/cases';
import { api } from '../../services/api';
import type { CaseId } from '../../types/telemetry';

export function TrialForm() {
  const [caseId, setCaseId] = useState<CaseId>('pir');
  const [groundTruth, setGroundTruth] = useState(true);
  const [detectedPresence, setDetectedPresence] = useState(true);
  const [latency, setLatency] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const latencyMs = Number(latency);
    if (latency.trim() === '' || !Number.isFinite(latencyMs) || latencyMs < 0) {
      setError('Ingresá una latencia válida, mayor o igual a cero.');
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.recordTrial({
        case_id: caseId,
        ground_truth: groundTruth,
        detected_presence: detectedPresence,
        latency_ms: latencyMs,
        notes,
      });
      setNotice(`Ensayo registrado para ${CASE_LABELS[caseId]}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo registrar el ensayo');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <GlassPanel>
      <SectionHeader title="Registrar ensayo experimental" subtitle="Compará la presencia observada con la detección del sensor" icon={<Send size={18} />} />
      <form className="trial-form" onSubmit={submit}>
        <label>
          Método
          <select value={caseId} onChange={(event) => setCaseId(event.target.value as CaseId)}>
            {Object.entries(CASE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>
          Presencia observada
          <select value={Number(groundTruth)} onChange={(event) => setGroundTruth(event.target.value === '1')}>
            <option value="1">Persona presente</option>
            <option value="0">Habitación vacía</option>
          </select>
        </label>
        <label>
          Detección del sensor
          <select value={Number(detectedPresence)} onChange={(event) => setDetectedPresence(event.target.value === '1')}>
            <option value="1">Presencia</option>
            <option value="0">Ausencia</option>
          </select>
        </label>
        <label>
          Latencia medida (ms)
          <input type="number" min="0" step="any" required value={latency} onChange={(event) => setLatency(event.target.value)} />
        </label>
        <label>
          Notas
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ensayo'}</button>
      </form>
      {notice && <p role="status" className="form-notice">{notice}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </GlassPanel>
  );
}
