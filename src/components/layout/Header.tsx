import React from 'react';
import { Activity, Linkedin, BookOpen, HelpCircle, Globe } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface HeaderProps {
    activeModule: 'beam' | 'truss';
    onModuleChange: (module: 'beam' | 'truss') => void;
    onShowDocs?: () => void;
    onShowHelp?: () => void;
}

export const Header = ({ activeModule, onModuleChange, onShowDocs, onShowHelp }: HeaderProps) => {
    const { t, language, setLanguage } = useLanguage();

    return (
        <header className="h-[44px] bg-slate-900/50 backdrop-blur-sm border-b border-slate-800/80 flex items-center justify-between px-4 z-50">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-2 md:gap-4">
                <div className="flex items-center gap-2 text-blue-500">
                    <Activity size={20} />
                    <span className="font-bold text-lg tracking-tight text-slate-100 hidden sm:inline">{t('app.title')}</span>
                </div>

                <div className="flex bg-slate-800/50 rounded-lg p-1 max-w-[160px] sm:max-w-none">
                    <button
                        onClick={() => onModuleChange('beam')}
                        className={`px-2 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${activeModule === 'beam' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <span className="hidden sm:inline">{t('app.beam')}</span>
                        <span className="sm:hidden">Beam</span>
                    </button>
                    <button
                        onClick={() => onModuleChange('truss')}
                        className={`px-2 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${activeModule === 'truss' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <span className="hidden sm:inline">{t('app.truss')}</span>
                        <span className="sm:hidden">Frame</span>
                    </button>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-3">
                <button
                    onClick={() => setLanguage(language === 'en' ? 'tr' : 'en')}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-colors"
                    title={language === 'en' ? 'Türkçe Yap' : 'Switch to English'}
                >
                    <Globe size={14} className="text-blue-400" />
                    <span>{language.toUpperCase()}</span>
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1 hidden sm:block"></div>
                <IconButton icon={<Linkedin size={16} />} href="https://www.linkedin.com/in/suuleymankaya0/" label={t('app.linkedin')} />
                <IconButton icon={<BookOpen size={16} />} label={t('app.docs')} onClick={onShowDocs} />
                <div className="hidden sm:block w-px h-4 bg-slate-700 mx-1"></div>
                <div className="hidden sm:block">
                    <IconButton icon={<HelpCircle size={16} />} label={t('app.help')} onClick={onShowHelp} />
                </div>
            </div>
        </header>
    );
};

const IconButton = ({ icon, href, label, onClick }: { icon: React.ReactNode; href?: string; label: string; onClick?: () => void }) => {
    const Comp = href ? 'a' : 'button';
    return (
        <Comp
            href={href}
            onClick={href ? undefined : onClick}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200"
            title={label}
            target={href ? "_blank" : undefined}
            rel={href ? "noopener noreferrer" : undefined}
        >
            {icon}
        </Comp>
    );
};
