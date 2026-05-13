import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface SmartInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: number;
  label?: string;
  disabled?: boolean;
}

const SmartInput: React.FC<SmartInputProps> = ({ value, onChange, placeholder, step = 1, label, disabled }) => {
  if (disabled) {
    return (
      <div className="flex-1 flex flex-col items-center group opacity-50 pointer-events-none">
        <div className="flex items-center w-full">
          <div className="w-full bg-slate-50 border-y border-slate-100 h-10 flex items-center justify-center text-slate-300 font-bold select-none text-sm rounded-xl">
            -
          </div>
        </div>
        {label && <span className="text-[10px] text-slate-300 mt-1 font-medium">{label}</span>}
      </div>
    );
  }

  const handleAdjust = (delta: number) => {
    const current = parseFloat(value) || 0;
    const next = Math.max(0, current + delta);
    onChange(Number.isInteger(next) ? next.toString() : next.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1'));
  };

  return (
    <div className="flex-1 flex flex-col items-center relative group">
      <div className="flex items-center w-full">
        <button onClick={() => handleAdjust(-step)} className="w-9 h-10 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-l-xl flex items-center justify-center transition-colors active:scale-95">
          <Minus size={16} />
        </button>
        <input 
          type="number" 
          placeholder={placeholder} 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className="w-full bg-slate-50 border-y border-slate-200 h-10 text-center font-bold outline-none text-slate-800 text-base z-10 focus:bg-white focus:border-orange-200 transition-colors" 
        />
        <button onClick={() => handleAdjust(step)} className="w-9 h-10 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-r-xl flex items-center justify-center transition-colors active:scale-95">
          <Plus size={16} />
        </button>
      </div>
      {label && <span className="text-[10px] text-slate-400 mt-1 font-medium">{label}</span>}
    </div>
  );
};

export default SmartInput;