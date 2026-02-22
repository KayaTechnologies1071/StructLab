import { useState, useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { Button } from './components/ui/Button';
import { Play, RotateCcw } from 'lucide-react';

// Beam Module
import { BeamEditor } from './features/beam/BeamEditor';
import { BeamVisualizer } from './features/beam/BeamVisualizer';
import { BeamResults } from './features/beam/BeamResults';
import { ContinuousBeamPanel } from './features/beam/ContinuousBeamPanel';
import { CrossMethodPanel } from './features/beam/CrossMethodPanel';
import { InfluenceLinePanel } from './features/beam/InfluenceLinePanel';
import type { Beam, AnalysisResult } from './features/beam/types';
import { BeamAnalyzer } from './engine/BeamAnalyzer';

// Truss Module
import { TrussEditor } from './features/truss/TrussEditor';
import { TrussVisualizer } from './features/truss/TrussVisualizer';
import { TrussResults } from './features/truss/TrussResults';
import type { Truss, TrussAnalysisResult } from './features/truss/types';
import { TrussAnalyzer } from './engine/TrussAnalyzer';

// Documentation
import { DocsPage } from './features/docs/DocsPage';
import { HelpModal } from './features/docs/HelpModal';

// Project Details
import { ProjectDetails } from './features/editor/ProjectDetails';

const INITIAL_BEAM: Beam = {
  length: 10,
  supports: [
    { id: 'A', type: 'pinned', position: 0 },
    { id: 'B', type: 'roller', position: 10 }
  ],
  hinges: [],
  loads: [
    { id: 'L1', type: 'point', magnitude: 20, position: 5 }
  ],
  elasticModulus: 200,
  momentOfInertia: 5000
};

const INITIAL_TRUSS: Truss = {
  nodes: [
    { id: '1', x: 0, y: 0, support: 'pinned' },
    { id: '2', x: 4, y: 0, support: 'roller' },
    { id: '3', x: 2, y: 3, support: 'none' } // 100kN down
  ],
  members: [
    { id: 'm1', startNodeId: '1', endNodeId: '2', area: 10, momentOfInertia: 5000, elasticModulus: 200 }, // Bottom
    { id: 'm2', startNodeId: '1', endNodeId: '3', area: 10, momentOfInertia: 5000, elasticModulus: 200 }, // Left diag
    { id: 'm3', startNodeId: '2', endNodeId: '3', area: 10, momentOfInertia: 5000, elasticModulus: 200 }  // Right diag
  ],
  loads: [
    { id: 'l1', type: 'nodal', nodeId: '3', fx: 0, fy: -100 }
  ]
};

function App() {
  const [activeModule, setActiveModule] = useState<'beam' | 'truss'>('beam');
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [rightTab, setRightTab] = useState<'results' | 'details'>('results');

  // Beam State
  const [beam, setBeam] = useState<Beam>(INITIAL_BEAM);
  const [beamResults, setBeamResults] = useState<AnalysisResult | null>(null);
  const [beamTab, setBeamTab] = useState<'results' | 'clapeyron' | 'cross' | 'influence'>('results');
  const [beamOverlay, setBeamOverlay] = useState<'none' | 'shear' | 'moment' | 'deflection'>('moment');

  // Truss State
  const [truss, setTruss] = useState<Truss>(INITIAL_TRUSS);
  const [trussResults, setTrussResults] = useState<TrussAnalysisResult | null>(null);

  // Auto-calculate Logic — debounced 300ms to avoid freezing on slider drag
  useEffect(() => {
    if (!autoCalculate) return;

    const timer = setTimeout(() => {
      if (activeModule === 'beam') {
        try {
          const res = BeamAnalyzer.analyze(beam);
          setBeamResults(res);
        } catch (e) { console.error(e); }
      } else {
        try {
          const res = TrussAnalyzer.analyze(truss);
          setTrussResults(res);
        } catch (e) { console.error(e); }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [beam, truss, activeModule, autoCalculate]);

  const handleCalculate = () => {
    if (activeModule === 'beam') {
      const res = BeamAnalyzer.analyze(beam);
      setBeamResults(res);
    } else {
      const res = TrussAnalyzer.analyze(truss);
      setTrussResults(res);
    }
  };

  const handleReset = () => {
    if (activeModule === 'beam') {
      setBeam(INITIAL_BEAM);
      setBeamResults(null);
    } else {
      setTruss(INITIAL_TRUSS);
      setTrussResults(null);
    }
  };

  // Render Logic
  const LeftPanel = (
    <div className="space-y-6 pb-20">
      {activeModule === 'beam' ? (
        <BeamEditor beam={beam} onChange={setBeam} />
      ) : (
        <TrussEditor truss={truss} onChange={setTruss} />
      )}

      <div className="glass-panel p-4 flex flex-col gap-3">
        <h3 className="text-xs uppercase font-bold text-slate-400">Analysis</h3>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={autoCalculate}
            onChange={e => setAutoCalculate(e.target.checked)}
            className="rounded bg-slate-800 border-slate-600 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-300">Auto-calculate</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button icon={<Play size={14} />} onClick={handleCalculate} variant="primary">Calculate</Button>
          <Button icon={<RotateCcw size={14} />} onClick={handleReset} variant="secondary">Reset</Button>
        </div>
      </div>
    </div>
  );

  const CenterPanel = (
    <div className="w-full h-full flex flex-col items-center justify-center bg-dots-pattern relative">
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="glass-panel-light p-2 text-xs text-slate-400 font-mono inline-block">
          {activeModule === 'beam'
            ? `Length: ${beam.length}m | Supports: ${beam.supports.length}`
            : `Nodes: ${truss.nodes.length} | Members: ${truss.members.length}`
          }
        </div>
      </div>

      {activeModule === 'beam' && (
        <div className="absolute top-4 right-4 flex gap-1 z-10 p-1 bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-700">
          {([
            { id: 'none', label: 'None' },
            { id: 'shear', label: 'Kesme Kuvveti (V)' },
            { id: 'moment', label: 'Moment (M)' },
            { id: 'deflection', label: 'Deplasman (δ)' }
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setBeamOverlay(opt.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${beamOverlay === opt.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="w-full h-full flex flex-col items-center justify-center p-2 lg:p-8 relative">
        {activeModule === 'beam' ? (
          <div className="w-full h-3/4 flex items-center justify-center">
            <BeamVisualizer beam={beam} results={beamResults} overlay={beamOverlay} />
          </div>
        ) : (
          <div className="flex-1 w-full h-full min-h-0 flex items-stretch">
            <TrussVisualizer truss={truss} results={trussResults} />
          </div>
        )}
      </div>
    </div>
  );

  const RightPanel = (
    <div className="pb-20">
      {rightTab === 'details' ? (
        <ProjectDetails
          activeModule={activeModule}
          beam={beam}
          truss={truss}
          beamResults={beamResults}
          trussResults={trussResults}
        />
      ) : activeModule === 'beam' ? (
        <div>
          {/* Tab Bar */}
          <div className="flex gap-1 mb-3 flex-wrap">
            {([
              { id: 'results', label: 'Sonuçlar' },
              { id: 'clapeyron', label: 'Clapeyron' },
              { id: 'cross', label: 'Cross' },
              { id: 'influence', label: 'Tesir' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setBeamTab(tab.id)}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${beamTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Tab Content */}
          {beamTab === 'results' && <BeamResults result={beamResults} beam={beam} />}
          {beamTab === 'clapeyron' && <ContinuousBeamPanel />}
          {beamTab === 'cross' && <CrossMethodPanel />}
          {beamTab === 'influence' && <InfluenceLinePanel beam={beam} />}
        </div>
      ) : (
        <TrussResults truss={truss} results={trussResults} />
      )}
    </div>
  );

  return (
    <>
      <MainLayout
        leftPanel={LeftPanel}
        centerPanel={CenterPanel}
        rightPanel={RightPanel}
        headerProps={{
          activeModule,
          onModuleChange: setActiveModule,
          onShowDocs: () => setShowDocs(true),
          onShowHelp: () => setShowHelp(true)
        }}
        fullWidth={false}
        rightTab={rightTab}
        onRightTabChange={setRightTab}
      />
      {showDocs && <DocsPage onClose={() => setShowDocs(false)} initialModule={activeModule} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}

export default App;
