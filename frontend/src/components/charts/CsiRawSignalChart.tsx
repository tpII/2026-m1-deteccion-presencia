import type { EChartsOption } from 'echarts';
import { Chart } from './Chart';
import { chartColors, formatSignalTime } from '../../services/charts';
import { SignalPoint } from '../../types/telemetry';
import { useTheme } from '../../context/ThemeContext';

interface CsiRawSignalChartProps {
  title?: string;
  points?: SignalPoint[];
  height?: number | string;
}

export function CsiRawSignalChart({ title, points, height = 240 }: CsiRawSignalChartProps) {
  const { isDark } = useTheme();

  if (!title && !points?.length) return <p className="muted">Esperando muestras de CSI.</p>;
  const { titleColor, textColor, axisLineColor, splitLineColor, tooltipBg, tooltipBorder, tooltipText } = chartColors(isDark);
  const rawPoints = points?.slice(-30) ?? [];
  const rawData = rawPoints.map((point) => [formatSignalTime(point.timestamp), point.value]);

  const option: EChartsOption = {
    title: title ? { text: title, left: 10, top: 5, textStyle: { fontSize: 12, fontWeight: 500, color: titleColor } } : undefined,
    series: [{
      name: title ?? 'Señal Cruda',
      type: 'line',
      data: rawData,
      showSymbol: rawPoints.length === 1,
      smooth: false,
      lineStyle: {
        width: 1.2,
        color: isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(14, 165, 233, 0.45)',
      },
      itemStyle: {
        color: isDark ? '#38bdf8' : '#0ea5e9',
      },
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: {
        color: tooltipText,
        fontSize: 12,
      },
    },
    legend: title ? undefined : {
      right: 15,
      top: 5,
      textStyle: {
        color: textColor,
        fontSize: 11,
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: title ? 40 : '14%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: {
        color: textColor,
        fontSize: 10,
        interval: Math.max(1, Math.floor(rawPoints.length / 6)),
      },
    },
    yAxis: {
      type: 'value',
      name: '|H|',
      nameTextStyle: {
        color: textColor,
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: splitLineColor,
          type: 'dashed',
        },
      },
      axisLabel: {
        color: textColor,
        fontSize: 10,
      },
    },
    animation: false,
  };

  return <Chart option={option} height={height} />;
}
