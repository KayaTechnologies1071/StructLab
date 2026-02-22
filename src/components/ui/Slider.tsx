import React from 'react';

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
}

export const Slider: React.FC<SliderProps> = ({
    label,
    value,
    min,
    max,
    unit = '',
    className = '',
    ...props
}) => {
    // Calculate percentage for background gradient
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 font-medium">{label}</label>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/50">
                    {value} <span className="text-slate-600 ml-0.5">{unit}</span>
                </span>
            </div>
            <div className="relative h-6 flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    className="w-full absolute z-20 opacity-0 cursor-pointer text-blue-500"
                    {...props}
                />
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden relative z-10">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-500"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div
                    className="w-4 h-4 bg-white rounded-full shadow-lg shadow-blue-500/50 absolute z-10 pointer-events-none transition-transform duration-75"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                />
            </div>
        </div>
    );
};
