import { useState } from 'react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SampleHistory } from '../components/metrics/SampleHistory';
import { ACTIVE_CASES, CASE_LABELS } from '../config/cases';
import type { CaseId } from '../types/telemetry';

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function ComparisonPage() {
  const [day, setDay] = useState(localToday);
  const [sensor, setSensor] = useState<CaseId | ''>('');

  return (
    <div className="page-stack">
      <GlassPanel className="sample-history-header">
        <div className="page-heading">
          <div>
            <h1>Historial de muestras</h1>
            <p>Consultá las lecturas de PIR y CSI guardadas en SQLite.</p>
          </div>
        </div>
        <div className="trial-form sample-history-filters">
          <label>
            Día (hora local)
            <input type="date" value={day} onChange={(event) => setDay(event.currentTarget.value)} />
          </label>
          <label>
            Sensor
            <select value={sensor} onChange={(event) => setSensor(event.currentTarget.value as CaseId | '')}>
              <option value="">PIR y CSI</option>
              {ACTIVE_CASES.map((id) => <option key={id} value={id}>{CASE_LABELS[id]}</option>)}
            </select>
          </label>
        </div>
      </GlassPanel>

      {day ? <SampleHistory key={`${day}:${sensor}`} day={day} sensor={sensor} /> : (
        <GlassPanel><p role="status">Elegí un día para consultar las muestras.</p></GlassPanel>
      )}
    </div>
  );
}
