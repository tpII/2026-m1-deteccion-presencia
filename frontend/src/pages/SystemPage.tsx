import { Settings } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SystemStatus } from '../components/system/SystemStatus';
import { TrialForm } from '../components/system/TrialForm';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/api';

export function SystemPage() {
  const { data: health, loading, error, refresh } = useApiQuery(api.getHealth);

  return (
    <div className="page-stack">
      <GlassPanel>
        <SectionHeader title="Sistema y ensayos" subtitle="Servicios y registro de ensayos con presencia observada" icon={<Settings size={18} />}
          action={<button className="secondary-button" onClick={refresh} disabled={loading}>Actualizar estado</button>}
        />
        <p>Configurá la red y el pin del PIR en firmware/pir/include/config.h antes de compilar con PlatformIO, y el broker del backend en .env.</p>
        {loading && <p role="status">Consultando servicios…</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </GlassPanel>
      <SystemStatus health={health} />
      <TrialForm />
    </div>
  );
}
