import type { EChartsOption } from 'echarts';
import { Chart } from './Chart';
import { chartColors, graphic, formatSignalTime } from '../../services/charts';
import { SignalPoint } from '../../types/telemetry';
import { useTheme } from '../../context/ThemeContext';

interface DigitalSignalChartProps {
  points: SignalPoint[];
  title?: string;
  height?: string | number;
}

export function DigitalSignalChart({
  points,
  title = 'Cronograma Digital PIR (0: Ausencia / 1: Detección)',
  height = 240,
}: DigitalSignalChartProps) {
  const { isDark } = useTheme();

  const { titleColor, textColor, axisLineColor, splitLineColor, tooltipBg, tooltipBorder, tooltipText } = chartColors(isDark);

  const data = points.map((point) => [formatSignalTime(point.timestamp), point.value >= 0.5 ? 1 : 0]);

  const option: EChartsOption = {
    title: {
      text: title,
      textStyle: {
        fontSize: 12,
        fontWeight: 500,
        color: titleColor,
      },
      left: 10,
      top: 5,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: {
        color: tooltipText,
      },
      valueFormatter: (value) => value === 1 ? 'PRESENCIA (1)' : 'AUSENCIA (0)',
    },
    grid: {
      left: '4%',
      right: '4%',
      bottom: '5%',
      top: '20%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: {
        color: textColor,
        fontSize: 10,
        interval: Math.max(1, Math.floor(points.length / 6)),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      interval: 1,
      axisLabel: {
        formatter: (val: number) => (val === 1 ? '1 (Presencia)' : '0 (Ausencia)'),
        color: textColor,
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: splitLineColor,
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: 'Nivel Lógico PIR',
        type: 'line',
        step: 'end',
        data: data,
        showSymbol: false,
        lineStyle: {
          width: 2.5,
          color: isDark ? '#34d399' : '#10b981',
        },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
          ]),
        },
      },
    ],
    animation: false,
  };

  return <Chart option={option} height={height} />;
}
