import React from 'react';
import { GlassPanel } from '../components/common/GlassPanel';
import { SectionHeader } from '../components/common/SectionHeader';
import { ComparisonBarChart } from '../components/charts/ComparisonBarChart';
import { useMetrics } from '../hooks/useMetrics';
import { BarChart3, Scale, Award, Info, RefreshCw } from 'lucide-react';

export const ComparisonPage: React.FC = () => {
  const { comparison, loading, refresh } = useMetrics();

  const metricsList = (comparison?.metrics || []).filter((metrics) => metrics.total_tests > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. ENCABEZADO DE COMPARACIÓN */}
      <GlassPanel>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-blue)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              <Scale size={14} />
              <span>Evaluación Experimental Cuantitativa</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              Comparación Académica de Métodos
            </h1>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '850px', lineHeight: 1.5, marginTop: '0.2rem' }}>
              Contraste metodológico entre el sensor infrarrojo piroeléctrico tradicional (PIR), la detección de presencia
              mediante CSI Wi-Fi sobre infraestructura de router existente, y el enlace de RF dedicado punto a punto con ESP32.
            </p>
          </div>

          <button
            onClick={refresh}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--glass-bg-hover)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Actualizar Métricas</span>
          </button>
        </div>
      </GlassPanel>

      {/* 2. TABLA COMPARATIVA PRINCIPAL */}
      <div>
        <SectionHeader
          title="Tabla Comparativa de Desempeño"
          subtitle="Síntesis de indicadores clave de detección y tiempos de respuesta"
          icon={<Award size={18} />}
        />

        <div className="glass-table-container">
          <table className="glass-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Métrica Experimental</th>
                <th style={{ width: '15%' }}>Unidad</th>
                <th style={{ width: '18%', color: '#059669' }}>Caso 1 — PIR</th>
                <th style={{ width: '18%', color: '#0284c7' }}>Caso 2 — CSI Router</th>
                <th style={{ width: '19%', color: '#6366f1' }}>Caso 3 — CSI Dedicado</th>
              </tr>
            </thead>
            <tbody>
              {comparison?.table.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.metric}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{row.unit}</td>
                  <td style={{ fontWeight: 600 }}>{row.pir}</td>
                  <td style={{ fontWeight: 600 }}>{row.csi_router}</td>
                  <td style={{ fontWeight: 600 }}>{row.csi_dedicated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. GRÁFICOS COMPARATIVOS */}
      <div>
        <SectionHeader
          title="Análisis Gráfico Comparativo"
          subtitle="Distribución visual de exactitud, errores de clasificación y retardo"
          icon={<BarChart3 size={18} />}
        />

        {metricsList.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Sin ensayos registrados para comparar.</p>}
        {metricsList.length > 0 && <div className="grid-2">
          <GlassPanel style={{ padding: '1rem' }}>
            <ComparisonBarChart
              metrics={metricsList}
              metricKey="detection_rate"
              title="Tasa de Detección (%)"
              unit="%"
              height={220}
            />
          </GlassPanel>

          <GlassPanel style={{ padding: '1rem' }}>
            <ComparisonBarChart
              metrics={metricsList}
              metricKey="average_latency_ms"
              title="Latencia Media (ms)"
              unit="ms"
              height={220}
            />
          </GlassPanel>

          <GlassPanel style={{ padding: '1rem' }}>
            <ComparisonBarChart
              metrics={metricsList}
              metricKey="false_positives"
              title="Falsos Positivos (FP)"
              unit="ensayos"
              height={220}
            />
          </GlassPanel>

          <GlassPanel style={{ padding: '1rem' }}>
            <ComparisonBarChart
              metrics={metricsList}
              metricKey="false_negatives"
              title="Falsos Negativos (FN)"
              unit="ensayos"
              height={220}
            />
          </GlassPanel>
        </div>}
      </div>

      <GlassPanel>
        <SectionHeader title="Análisis de los datos adquiridos" icon={<Info size={18} />} />
        <p style={{ color: 'var(--text-secondary)' }}>
          Registrá ensayos con hardware y una observación independiente de presencia en Sistema &amp; Hardware.
          La comparación utiliza esos registros. Documentá ubicación, movimiento, personas y condiciones del ambiente
          para evaluar los resultados después de la adquisición.
        </p>
      </GlassPanel>
    </div>
  );
};
