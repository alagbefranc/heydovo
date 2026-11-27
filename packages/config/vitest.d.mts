export declare const baseTest: {
  passWithNoTests: false;
  restoreMocks: true;
  unstubEnvs: true;
  unstubGlobals: true;
};

export interface CoverageFloor {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export declare const coverageThresholds: {
  standard: CoverageFloor;
  critical: CoverageFloor;
};
