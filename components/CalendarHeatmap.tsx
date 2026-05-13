
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { HistoryItemType, RewardRecord } from '../types';
import { getLocalDateString } from '../utils';

interface CalendarHeatmapProps {
  history?: HistoryItemType[];
  rewards?: RewardRecord[];
  dataType?: 'workout' | 'reward';
  onSelectDate: (date: string | null) => void;
}

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ history = [], rewards = [], dataType = 'workout', onSelectDate }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const changeMonth = (delta: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setViewDate(newDate);
  };

  const jumpToDate = (year: number, month: number) => {
      const newDate = new Date(year, month, 1);
      setViewDate(newDate);
      setShowPicker(false);
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Data Mapping
    const workMap: Record<string, string> = {}; // 'workout' | 'rest' | 'reward-1' | 'reward-2'
    
    if (dataType === 'workout') {
        history.forEach(h => {
            if (h.type === 'workout') workMap[h.date] = 'workout';
            else if (h.type === 'rest') workMap[h.date] = 'rest';
        });
    } else {
        rewards.forEach(r => {
            if (r.count >= 2) workMap[r.date] = 'reward-high';
            else if (r.count > 0) workMap[r.date] = 'reward-low';
        });
    }

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push({ type: 'empty', key: `empty-${i}` });
    for (let i = 1; i <= daysInMonth; i++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(i).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      days.push({
        type: 'day', 
        key: dateStr, 
        dayNum: i, 
        status: workMap[dateStr] || 'none', 
        isToday: dateStr === getLocalDateString()
      });
    }
    return days;
  }, [viewDate, history, rewards, dataType]);

  const monthLabel = viewDate.toLocaleString('zh-CN', { year: 'numeric', month: 'long' });
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: Math.max(2, currentYear - 2024 + 2)}, (_, i) => 2025 + i);
  const months = Array.from({length: 12}, (_, i) => i);

  const getDayColor = (status: string, isSelected: boolean) => {
      if (dataType === 'workout') {
          if (status === 'workout') return 'bg-orange-500 text-white';
          if (status === 'rest') return 'bg-blue-100 text-blue-500';
      } else {
          // Reward Mode Colors (Pink/Rose)
          if (status === 'reward-high') return 'bg-rose-500 text-white';
          if (status === 'reward-low') return 'bg-rose-300 text-white';
      }
      return 'bg-slate-50 text-slate-400 dark:bg-slate-700 dark:text-slate-500';
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 relative">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><ChevronLeft size={20} /></button>
        
        <div className="relative">
            <button onClick={() => setShowPicker(!showPicker)} className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
                {monthLabel} <ChevronDown size={14} className={`transition-transform ${showPicker ? 'rotate-180' : ''}`}/>
            </button>

            {showPicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl rounded-xl p-4 z-50 w-64 animate-in fade-in zoom-in-95">
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="max-h-32 overflow-y-auto no-scrollbar space-y-1">
                            {years.map(y => (
                                <button key={y} onClick={() => jumpToDate(y, viewDate.getMonth())} className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold ${viewDate.getFullYear() === y ? 'bg-orange-50 text-orange-500' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    {y}年
                                </button>
                            ))}
                        </div>
                         <div className="max-h-32 overflow-y-auto no-scrollbar space-y-1">
                            {months.map(m => (
                                <button key={m} onClick={() => jumpToDate(viewDate.getFullYear(), m)} className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold ${viewDate.getMonth() === m ? 'bg-orange-50 text-orange-500' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    {m + 1}月
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-center text-[10px] text-slate-400 mb-1 font-bold">{d}</div>)}
        {calendarDays.map((day: any) => {
          if (day.type === 'empty') return <div key={day.key} className="aspect-square"></div>;
          const isSelected = day.key === selected;
          const colorClass = getDayColor(day.status, isSelected);

          return (
            <div key={day.key}
              onClick={() => {
                const newSel = isSelected ? null : day.key;
                setSelected(newSel);
                onSelectDate(newSel);
              }}
              className={`
                aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold relative transition-all cursor-pointer
                ${colorClass}
                ${day.isToday ? 'ring-2 ring-slate-800 dark:ring-white ring-offset-1' : ''}
                ${isSelected ? 'ring-4 ring-orange-200 dark:ring-orange-900/50 scale-110 z-10' : ''}
            `}>
              {day.dayNum}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-400 font-bold">
          {dataType === 'workout' ? (
              <>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-500"></div> 训练日</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-100"></div> 休息日</div>
              </>
          ) : (
              <>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-rose-300"></div> 1次</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-rose-500"></div> 2次+</div>
              </>
          )}
      </div>
    </div>
  );
};

export default CalendarHeatmap;
