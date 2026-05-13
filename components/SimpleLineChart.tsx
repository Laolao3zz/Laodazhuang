import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ChartDataPoint } from '../types';

interface SimpleLineChartProps {
  data: ChartDataPoint[];
  color?: string;
  height?: number;
  suffix?: string;
  title?: string;
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, color = "#f97316", height = 200, suffix = "", title }) => {
  if (!data || data.length < 2) return (
    <div className="flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800" style={{ height: `${height}px` }}>
      <BarChart3 size={24} className="mb-2 opacity-20" />
      <span>暂无足够数据</span>
    </div>
  );

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  // Add some padding to the range so the line doesn't touch top/bottom edges exactly
  const range = maxVal - minVal || 1;
  const padding = range * 0.2; 
  const displayMax = maxVal + padding;
  const displayMin = Math.max(0, minVal - padding);
  const displayRange = displayMax - displayMin;

  // 坐标点计算 (0-100)
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.value - displayMin) / displayRange) * 100;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x},100 L ${points[0].x},100 Z`;

  return (
    <div className="w-full relative group select-none" style={{ height: `${height}px` }}>
      {/* Title / Current Value Badge */}
      <div className="absolute top-0 right-0 flex flex-col items-end z-10">
          <div className="text-xs font-bold text-slate-400 mb-0.5">{title}</div>
          <div className="flex items-baseline gap-1 bg-white/90 backdrop-blur px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
            <span className="text-xl font-black" style={{ color }}>{Math.round(data[data.length - 1].value * 10) / 10}</span> 
            <span className="text-xs font-bold text-slate-400">{suffix}</span>
          </div>
      </div>

      <div className="absolute inset-0 pt-8 pb-6 flex items-end">
        <div className="relative w-full h-full">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 overflow-visible">
            <defs>
              <linearGradient id={`grad-simple-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
            <line x1="0" y1="100" x2="100" y2="100" stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" />

            {/* Chart */}
            <path d={areaPath} fill={`url(#grad-simple-${color.replace('#', '')})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {points.map((p, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-white border-[2.5px] transition-all duration-300 group-hover:scale-100 scale-0 origin-center shadow-sm z-10"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                borderColor: color,
                transform: 'translate(-50%, -50%)'
              }}
            />
          ))}
          {/* Always show the last point */}
          <div
              className="absolute w-3 h-3 rounded-full bg-white border-[2.5px] shadow-sm z-10 animate-pulse"
              style={{
                left: `${points[points.length-1].x}%`,
                top: `${points[points.length-1].y}%`,
                borderColor: color,
                transform: 'translate(-50%, -50%)'
              }}
            />
        </div>
      </div>
      
      {/* Date Labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-300 px-1 font-mono">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
};

export default SimpleLineChart;