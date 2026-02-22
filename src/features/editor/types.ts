export type SupportType = 'none' | 'pinned' | 'roller' | 'fixed' | 'roller-x' | 'roller-y';

// 3 DOFs per node: x (0), y (1), rotation (2)
export interface Restraints {
    dx: boolean; // true = fixed
    dy: boolean;
    rz: boolean;
}

export interface Node {
    id: string;
    x: number;
    y: number;
    restraints: Restraints;
    /** Elastic spring support stiffnesses (kN/m or kNm/rad) */
    elasticSupport?: { kx?: number; ky?: number; krz?: number };
    /** Prescribed displacement — settlement in m (positive = down for dy) */
    prescribedDx?: number;
    prescribedDy?: number;
}

export interface Material {
    id: string;
    name: string;
    E: number; // Elastic Modulus (GPa)
    density?: number;
}

export interface Section {
    id: string;
    name: string;
    A: number; // Area (cm^2)
    I: number; // Moment of Inertia (cm^4)
}

export interface MemberRelease {
    startMoment: boolean; // True = Hinge at start
    endMoment: boolean;   // True = Hinge at end
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    materialId: string;
    sectionId: string;
    releases?: MemberRelease;
}

export type LoadType = 'nodal' | 'member_distributed' | 'member_point' | 'temperature';

export interface Load {
    id: string;
    type: LoadType;
    targetId: string; // Node ID or Member ID

    // For Nodal Loads
    fx?: number; // kN
    fy?: number; // kN
    mz?: number; // kNm

    // For Member Distributed Loads
    wStart?: number; // kN/m (negative = down)
    wEnd?: number;

    // For Member Point Loads
    P?: number; // kN
    L?: number; // Distance from start node (m or ratio?) -> let's use meters

    // For Temperature Loads (on members)
    deltaT?: number; // Uniform temperature change (°C)
    gradient?: number; // Temperature gradient across depth (°C/m)
    alpha?: number; // Thermal expansion coefficient (1/°C)
    depth?: number; // Section depth (m) — used with gradient
}

export interface Structure {
    nodes: Node[];
    members: Member[];
    materials: Material[];
    sections: Section[];
    loads: Load[];
}

export interface NodeResult {
    dx: number; // m
    dy: number; // m
    rz: number; // rad
}

export interface MemberResult {
    startForce: { N: number; V: number; M: number };
    endForce: { N: number; V: number; M: number };
    // Possibly intermediate points for diagrams
}

export interface AnalysisResult {
    nodeDisplacements: Record<string, NodeResult>;
    memberForces: Record<string, MemberResult>;
    reactions: Record<string, { fx: number; fy: number; mz: number }>;
}
