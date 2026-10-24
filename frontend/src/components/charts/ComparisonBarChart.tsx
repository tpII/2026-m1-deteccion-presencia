import type { EChartsOption } from 'echarts';
import { Chart } from './Chart';
import { chartColors } from '../../services/charts';
import { CASE_LABELS } from '../../config/cases';
import { CaseMetrics } from '../../types/metrics';
import { useTheme } from '../../context/ThemeContext';

interface ComparisonBarChartProps {
  metrics: CaseMetrics[];
  metricKey: 'detection_rate' | 'false_positives' | 'false_negatives' | 'average_latency_ms';
  title: string;
  unit: string;
  height?: number;
}

export function ComparisonBarChart({
  metrics,
  metricKey,
  title,
  unit,
  height = 220,
}: ComparisonBarChartProps) {
  const { isDark } = useTheme();

  const { titleColor, textColor, axisLineColor, splitLineColor, tooltipBg, tooltipBorder, tooltipText } = chartColors(isDark);

  const categories = metrics.map((metric) => CASE_LABELS[metric.case_id]);
  const values = metrics.map((m) => m[metricKey]);

  const colors = {
    pir: isDark ? '#10b981' : '#059669',
    csi_router: isDark ? '#38bdf8' : '#0284c7',
    csi_dedicated: isDark ? '#818cf8' : '#6366f1',
  };

  const option: EChartsOption = {
    title: {
      text: title,
      textStyle: {
        fontSize: 12,
        fontWeight: 600,
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
      valueFormatter: (value) => `${value} ${unit}`,
    },
    grid: {
      left: '4%',
      right: '4%',
      bottom: '8%',
      top: '25%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: {
        color: textColor,
        fontSize: 11,
        fontWeight: 500,
      },
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameTextStyle: { color: textColor, fontSize: 10 },
      splitLine: {
        lineStyle: { color: splitLineColor, type: 'dashed' },
      },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    series: [
      {
        name: title,
        type: 'bar',
        barWidth: '40%',
        data: values.map((val, idx) => ({
          value: val,
          itemStyle: {
            color: colors[metrics[idx].case_id],
            borderRadius: [6, 6, 0, 0],
          },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: `{c} ${unit}`,
          fontSize: 10,
          color: titleColor,
        },
      },
    ],
  };

  return <Chart option={option} height={height} />;
}
