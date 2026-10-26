import { init, use, graphic } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkLineComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LegacyGridContainLabel } from 'echarts/features';
import 'echarts/theme/v5';

use([BarChart, LineChart, GridComponent, LegendComponent, MarkLineComponent, TitleComponent, TooltipComponent, CanvasRenderer, LegacyGridContainLabel]);

export { init, graphic };

export function chartColors(isDark: boolean) {
  return {
    titleColor: isDark ? '#f1f5f9' : '#334155',
    textColor: isDark ? '#94a3b8' : '#64748b',
    axisLineColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
    splitLineColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.6)',
    tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0',
    tooltipText: isDark ? '#f8fafc' : '#0f172a',
  };
}

export function formatSignalTime(timestamp: number): string {
  const date = new Date(timestamp);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const tenths = Math.floor(date.getMilliseconds() / 100);
  return `${minutes}:${seconds}.${tenths}`;
}
