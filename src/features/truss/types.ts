export type SupportType = 'none' | 'pinned' | 'roller' | 'fixed';

export interface Node {
    id: string;
    x: number;
    y: number;
    support: SupportType;
    supportAngle?: number; // In degrees, for inclined supports (especially rollers)
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    area: number; // Cross-sectional area A in cm^2
    momentOfInertia: number; // I in cm^4 (Needed for Frame Analysis)
    elasticModulus: number; // E in GPa
}

export interface TrussLoad {
    id: string;
    // 'nodal': Nodal forces Fx, Fy, and Moment M
    // 'temperature': Temperature changes for thermal strain
    // 'point': Point load along member length
    // 'distributed': Uniformly distributed load along member length
    type: 'nodal' | 'temperature' | 'point' | 'distributed';

    // Nodal parameters
    nodeId?: string;
    fx?: number;     // kN (Global X)
    fy?: number;     // kN (Global Y)
    m?: number;      // kNm (Moment on Node)

    // Member parameters
    memberId?: string;
    deltaT?: number; // °C
    thermalAlpha?: number; // 1/°C

    // For Point & Distributed Loads
    magnitude?: number; // kN or kN/m
    position?: number; // meters from start node (for point load)
    startPosition?: number; // meters (for distributed)
    endPosition?: number; // meters (for distributed)
    angle?: number; // 90° is perpendicular. In global or local? Let's use Local (90 = perpendicular, 0 = axial)
}

export interface Truss {
    nodes: Node[];
    members: Member[];
    loads: TrussLoad[];
}

export interface TrussAnalysisResult {
    // 3 DOF: dx, dy, and rotation theta (radians)
    nodeDisplacements: Record<string, { dx: number; dy: number; theta: number }>;

    // Results at start and end of members for building diagrams
    // forces: [Axial, Shear, Moment] at member start and end
    memberResults: Record<string, {
        start: { n: number; v: number; m: number };
        end: { n: number; v: number; m: number };
        // We'll also return points for diagrams (useful for distributed loads where shear/moment is non-linear)
        diagrams?: { x: number; n: number; v: number; m: number; d: number }[];
    }>;

    reactions: Record<string, { rx: number; ry: number; rm: number }>;
}
