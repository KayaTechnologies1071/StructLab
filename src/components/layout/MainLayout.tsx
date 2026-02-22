import React, { useState } from 'react';
import { Header } from './Header';
import { Settings2, PenTool, BarChart2 } from 'lucide-react';

interface MainLayoutProps {
    leftPanel: React.ReactNode;
    centerPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    headerProps: {
        activeModule: 'beam' | 'truss';
        onModuleChange: (module: 'beam' | 'truss') => void;
        onShowDocs?: () => void;
        onShowHelp?: () => void;
    };
    fullWidth?: boolean;
    rightTab?: 'results' | 'details';
    onRightTabChange?: (tab: 'results' | 'details') => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    leftPanel,
    centerPanel,
    rightPanel,
    headerProps,
    fullWidth = false,
    rightTab = 'results',
    onRightTabChange
}) => {
    const [mobileTab, setMobileTab] = useState<'controls' | 'canvas' | 'results'>('canvas');

    const isMobileControls = mobileTab === 'controls';
    const isMobileCanvas = mobileTab === 'canvas';
    const isMobileResults = mobileTab === 'results';

    return (
        <div className="h-screen w-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0e1a] to-[#050510] text-slate-200 flex flex-col overflow-hidden font-inter selection:bg-blue-500/30">
            <Header {...headerProps} />

            <main className="flex-1 flex overflow-hidden lg:flex-row flex-col">
                {/* Left Panel - Controls */}
                <div className={`${!fullWidth ? (isMobileControls ? 'flex' : 'hidden lg:flex') : 'hidden'} lg:w-72 lg:min-w-[280px] w-full h-full lg:border-r border-slate-800/50 bg-[#0a0e1a]/50 flex-col`}>
                    <div className="p-3 border-b border-slate-800/50">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <span>🎛️</span> Controls
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                        {leftPanel}
                    </div>
                </div>

                {/* Center Canvas Area */}
                <div className={`${isMobileCanvas ? 'flex' : 'hidden lg:flex'} flex-1 flex-col relative bg-gradient-to-b from-[#080c16] to-[#0f172a]`}>
                    <div className="flex-1 relative overflow-hidden">
                        {centerPanel}
                    </div>

                    {!fullWidth && (
                        <div className="h-8 border-t border-slate-800/50 bg-[#0a0e1a]/80 backdrop-blur flex items-center px-4 text-[10px] text-slate-500 font-mono justify-between">
                            <span>x: 0.00m</span>
                            <span>Scale: 1:100</span>
                        </div>
                    )}
                </div>

                {/* Right Panel - Results */}
                <div className={`${!fullWidth ? (isMobileResults ? 'flex' : 'hidden lg:flex') : 'hidden'} lg:w-80 lg:min-w-[300px] w-full h-full lg:border-l border-slate-800/50 bg-[#0a0e1a]/50 flex-col`}>
                    <div className="flex border-b border-slate-800/50">
                        <button
                            onClick={() => onRightTabChange?.('results')}
                            className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${rightTab === 'results' ? 'text-cyan-400 border-cyan-500 bg-slate-800/20' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/10'}`}
                        >
                            📊 Results
                        </button>
                        <button
                            onClick={() => onRightTabChange?.('details')}
                            className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${rightTab === 'details' ? 'text-cyan-400 border-cyan-500 bg-slate-800/20' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/10'}`}
                        >
                            📝 Details
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 pb-20 lg:pb-3">
                        {rightPanel}
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden flex items-center justify-around bg-[#0a0e1a] border-t border-slate-800 p-2 z-50">
                <button onClick={() => setMobileTab('controls')} className={`flex flex-col items-center px-4 py-2 rounded-lg ${isMobileControls ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Settings2 size={20} />
                    <span className="text-[10px] mt-1 font-semibold uppercase tracking-wider">Controls</span>
                </button>
                <button onClick={() => setMobileTab('canvas')} className={`flex flex-col items-center px-4 py-2 rounded-lg ${isMobileCanvas ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}>
                    <PenTool size={20} />
                    <span className="text-[10px] mt-1 font-semibold uppercase tracking-wider">Workspace</span>
                </button>
                <button onClick={() => setMobileTab('results')} className={`flex flex-col items-center px-4 py-2 rounded-lg ${isMobileResults ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}>
                    <BarChart2 size={20} />
                    <span className="text-[10px] mt-1 font-semibold uppercase tracking-wider">Results</span>
                </button>
            </div>
        </div>
    );
};
