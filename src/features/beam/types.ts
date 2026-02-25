export type SupportType = 'pinned' | 'roller' | 'fixed';
export type LoadType = 'point' | 'distributed' | 'moment';

export interface Support {
    id: string;
    type: SupportType;
    position: number; // x-coordinate in meters
    settlement?: number; // prescribed vertical displacement (m), downward positive
    supportAngle?: number; // rotation in degrees for visual and reaction derivation
}

export interface Hinge {
    id: string;
    position: number; // x-coordinate in meters
}

export interface Load {
    id: string;
    type: LoadType;
    magnitude: number; // kN or kN/m or kNm
    position: number; // x-coordinate for point/moment
    startPosition?: number; // for distributed
    endPosition?: number; // for distributed
    angle?: number; // degrees, default 90 (vertical down)
    endMagnitude?: number; // for varying distributed loads (trapezoidal/triangular)
}

export interface TemperatureLoad {
    deltaT: number;     // Temperature change (°C)
    alpha: number;      // Thermal expansion coefficient (1/°C), default 1.2e-5 for steel
    gradient?: number;  // Temperature gradient across depth (°C/m), causes bending
    depth?: number;     // Section depth (m), used with gradient
}

export interface Beam {
    length: number; // meters
    supports: Support[];
    hinges: Hinge[]; // Internal hinges
    loads: Load[];
    elasticModulus: number; // E in GPa
    momentOfInertia: number; // I in cm^4 (for now)
    crossSectionArea?: number; // A in cm^2 (for thermal axial effects)
    temperatureLoad?: TemperatureLoad;
    deflectionPoints?: { x: number, deflection: number }[]; // Added for visualization
}

export interface AnalysisPoint {
    x: number;
    shear: number;
    moment: number;
    deflection: number;
}

export interface AnalysisResult {
    reactions: Record<string, number>; // map support ID to reaction force (vertical)
    momentReaction?: Record<string, number>; // map support ID to reaction moment (for fixed)
    diagrams: AnalysisPoint[];
    maxMoment: number;
    maxShear: number;
    maxDeflection: number;
}
