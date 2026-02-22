import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: ReactNode;
}

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    className = '',
    ...props
}: ButtonProps) => {
    const baseStyles = "flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 border border-transparent",
        secondary: "bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700/80 hover:text-white hover:border-slate-500/50",
        ghost: "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
        danger: "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-0.5"
    };

    const sizes = {
        xs: "px-2 py-1 text-[10px]",
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {icon && <span className="w-4 h-4">{icon}</span>}
            {children}
        </button>
    );
};
