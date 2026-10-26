import type { EChartsOption } from 'echarts';
import { Chart } from './Chart';
import { chartColors, formatSignalTime } from '../../services/charts';
import type { SignalPoint } from '../../types/telemetry';
import { useTheme } from '../../context/ThemeContext';

interface IndicatorChartProps {
  title: string;
  points: SignalPoint[];
  /** Umbral calibrado; sin calibración no se dibuja. */
  threshold?: number | null;
  height?: number;
}

/** Un indicador del detector CSI en el tiempo, con su umbral como línea punteada. */
export function IndicatorChart({ title, points, threshold, height = 220 }: IndicatorChartProps) {
  const { isDark } = useTheme();
  const { titleColor, textColor, axisLineColor, splitLineColor, tooltipBg, tooltipBorder, tooltipText } = chartColors(isDark);
  const lineColor = isDark ? '#38bdf8' : '#0284c7';

  const option: EChartsOption = {
    title: { text: title, left: 10, top: 5, textStyle: { fontSize: 12, fontWeight: 500, color: titleColor } },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
      valueFormatter: (value) => Number(value).toFixed(4),
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((point) => formatSignalTime(point.timestamp)),
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: textColor, fontSize: 10, interval: Math.max(1, Math.floor(points.length / 6)) },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    series: [{
      name: title,
      type: 'line',
      data: points.map((point) => point.value),
      showSymbol: false,
      lineStyle: { width: 2, color: lineColor },
      itemStyle: { color: lineColor },
      markLine: threshold == null ? undefined : {
        symbol: 'none',
        silent: true,
        lineStyle: { type: 'dashed', color: textColor, width: 1.2 },
        label: { formatter: `umbral ${threshold.toFixed(3)}`, color: textColor, fontSize: 10, position: 'insideEndTop' },
        data: [{ yAxis: threshold }],
      },
    }],
    animation: false,
  };

  return <Chart option={option} height={height} />;
}
