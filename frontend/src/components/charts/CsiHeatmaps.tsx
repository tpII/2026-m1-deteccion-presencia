import { memo, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import { chartColors } from '../../services/charts';
import { useTheme } from '../../context/ThemeContext';
import { CSI_ACTIVITIES, type CsiActivity, type CsiHeatmap } from '../../types/csiCapture';
import { Chart } from './Chart';

const SUBCARRIERS = Array.from({ length: 57 }, (_, index) => index - 28)
  .filter((index) => index !== 0 && index !== 1).map(String);
const COLORS = ['#eff6ff', '#bfdbfe', '#60a5df', '#2574b4', '#082f65'];
const ACTIVITIES = Object.keys(CSI_ACTIVITIES) as CsiActivity[];

const Heatmap = memo(function Heatmap({ heatmap, min, max }: { heatmap: CsiHeatmap; min: number; max: number }) {
  const { isDark } = useTheme();
  const { textColor, axisLineColor } = chartColors(isDark);
  const times = Array.from({ length: heatmap.column_count }, (_, index) => String(index * heatmap.step_seconds));
  const option: EChartsOption = {
    animation: false,
    grid: { left: 53, right: 17, top: 12, bottom: 47 },
    xAxis: {
      type: 'category',
      data: times,
      name: 'Tiempo (s)',
      nameLocation: 'center',
      nameGap: 27,
      nameTextStyle: { color: textColor },
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: textColor, interval: Math.floor(times.length / 5) },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      data: SUBCARRIERS,
      name: 'Subportadora k',
      nameLocation: 'center',
      nameGap: 35,
      nameTextStyle: { color: textColor },
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: textColor, interval: 8 },
      splitArea: { show: false },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (Array.isArray(params) || !Array.isArray(params.value)) return '';
        const [time, carrier, amplitude] = params.value;
        return `${time} s · k = ${carrier}<br/>Amplitud relativa: ${Number(amplitude).toFixed(3)}`;
      },
    },
    visualMap: { show: false, min, max, dimension: 2, inRange: { color: COLORS } },
    series: [{
      type: 'heatmap',
      data: heatmap.columns.flatMap(({ index, relative_amplitudes }) =>
        relative_amplitudes.map((amplitude, carrier) => [times[index], SUBCARRIERS[carrier], amplitude])),
    }],
  };
  return <Chart option={option} height={270} />;
});

export function CsiHeatmaps({ heatmaps, activeActivity, renderControl }: {
  heatmaps: CsiHeatmap[];
  activeActivity?: CsiActivity;
  renderControl: (activity: CsiActivity) => ReactNode;
}) {
  let min = 1;
  let max = 1;
  for (const heatmap of heatmaps) {
    for (const column of heatmap.columns) {
      for (const amplitude of column.relative_amplitudes) {
        min = Math.min(min, amplitude);
        max = Math.max(max, amplitude);
      }
    }
  }
  const hasSamples = heatmaps.some((heatmap) => heatmap.columns.length > 0);
  // Redondeo hacia afuera para que la escala no recorte ningún valor.
  const scaleMin = Math.floor(min * 10) / 10;
  const scaleMax = Math.max(scaleMin + 0.1, Math.ceil(max * 10) / 10);
  return (
    <>
      <div className="csi-heatmaps">
        {ACTIVITIES.map((activity) => {
          const heatmap = heatmaps.find((item) => item.capture.activity === activity);
          const isLive = activeActivity === activity;
          return (
            <section key={activity} className="csi-heatmap">
              <header className="csi-heatmap-heading">
                <h4>{CSI_ACTIVITIES[activity]}</h4>
                {isLive && <span className="glass-badge status-live">En vivo</span>}
              </header>
              <div className="csi-heatmap-plot">
                {heatmap?.columns.length ? <Heatmap heatmap={heatmap} min={scaleMin} max={scaleMax} /> : (
                  <p className="muted">{isLive ? 'Esperando paquetes CSI…'
                    : heatmap ? 'La captura no recibió paquetes CSI de 55 subportadoras.' : 'Todavía no hay una captura.'}</p>
                )}
              </div>
              {renderControl(activity)}
            </section>
          );
        })}
      </div>
      {hasSamples && (
        <div className="csi-heatmap-scale" aria-label="Escala común de amplitud relativa">
          <span>Amplitud relativa</span>
          <span>{scaleMin.toFixed(1)}</span>
          <span aria-hidden="true" className="csi-heatmap-gradient"
            style={{ background: `linear-gradient(to right, ${COLORS.join(', ')})` }} />
          <span>{scaleMax.toFixed(1)}</span>
        </div>
      )}
    </>
  );
}
