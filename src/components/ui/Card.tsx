import React from 'react';

interface CardProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, title, action, className = '' }) => {
    return (
        <div className={`glass - panel p - 4 flex flex - col gap - 3 ${className} `}>
            {(title || action) && (
                <div className="flex items-center justify-between border-b border-slate-700/30 pb-2 mb-1">
                    {title && (
                        <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                            {title}
                        </h3>
                    )}
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className="text-sm text-slate-300">
                {children}
            </div>
        </div>
    );
};
