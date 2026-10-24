import { BarChart3, Info, RefreshCw, Scale } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ComparisonBarChart } from '../components/charts/ComparisonBarChart';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/api';

const charts = [
  { metricKey: 'detection_rate', title: 'Exactitud', unit: '%' },
  { metricKey: 'average_latency_ms', title: 'Latencia media', unit: 'ms' },
  { metricKey: 'false_positives', title: 'Falsos positivos', unit: 'ensayos' },
  { metricKey: 'false_negatives', title: 'Falsos negativos', unit: 'ensayos' },
] as const;

export function ComparisonPage() {
  const { data: comparison, loading, error, refresh } = useApiQuery(api.getSystemComparison);
  const metrics = (comparison?.metrics ?? []).filter((metric) => metric.total_tests > 0);

  return (
    <div className="page-stack">
      <GlassPanel>
        <SectionHeader title="Comparación de métodos" subtitle="Resultados de los ensayos con PIR y CSI" icon={<Scale size={18} />}
          action={<button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> Actualizar métricas</button>}
        />
        <p>Comparación de detección, errores y latencia a partir de observaciones registradas.</p>
      </GlassPanel>
      {error && <p role="alert" className="form-error">{error}</p>}
      {loading && <p role="status">Cargando comparación…</p>}
      {comparison && (
        <section>
          <SectionHeader title="Desempeño experimental" subtitle="Indicadores por método" />
          <div className="glass-table-container">
            <table className="glass-table">
              <thead><tr><th>Métrica</th><th>Unidad</th><th>PIR</th><th>CSI Router</th><th>CSI Dedicado</th></tr></thead>
              <tbody>
                {comparison.table.map((row) => (
                  <tr key={row.metric}><td>{row.metric}</td><td>{row.unit}</td><td>{row.pir}</td><td>{row.csi_router}</td><td>{row.csi_dedicated}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section>
        <SectionHeader title="Comparación gráfica" subtitle="Exactitud, errores y latencia" icon={<BarChart3 size={18} />} />
        {!loading && !error && metrics.length === 0 && <p>Sin ensayos registrados para comparar.</p>}
        {metrics.length > 0 && (
          <div className="grid-2">
            {charts.map((chart) => <GlassPanel key={chart.metricKey}><ComparisonBarChart {...chart} metrics={metrics} /></GlassPanel>)}
          </div>
        )}
      </section>
      <GlassPanel>
        <SectionHeader title="Datos adquiridos" icon={<Info size={18} />} />
        <p>Registrá ensayos con hardware y una observación independiente de presencia en Sistema &amp; Hardware. Documentá ubicación, movimiento, personas y condiciones del ambiente para interpretar los resultados.</p>
      </GlassPanel>
    </div>
  );
}
