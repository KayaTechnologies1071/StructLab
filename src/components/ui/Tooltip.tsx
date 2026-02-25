import React, { type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
    content: string;
    children?: ReactNode;
    iconOnly?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, iconOnly = false }) => {
    return (
        <div className="relative group inline-flex items-center">
            {iconOnly ? (
                <div className="text-slate-500 hover:text-slate-300 cursor-help transition-colors">
                    <HelpCircle size={14} />
                </div>
            ) : (
                children
            )}
            <div className="absolute z-[100] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded shadow-xl border border-slate-700/50 pointer-events-none">
                {content}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
        </div>
    );
};
