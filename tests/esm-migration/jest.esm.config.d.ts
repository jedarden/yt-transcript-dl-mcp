declare namespace _default {
    let preset: string;
    let extensionsToTreatAsEsm: string[];
    let testEnvironment: string;
    let moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': string;
    };
    let transform: {
        '^.+\\.ts$': (string | {
            useESM: boolean;
            tsconfig: {
                module: string;
                target: string;
                moduleResolution: string;
                allowSyntheticDefaultImports: boolean;
                esModuleInterop: boolean;
            };
        })[];
    };
    let testMatch: string[];
    let setupFilesAfterEnv: string[];
    let collectCoverageFrom: string[];
    let coverageDirectory: string;
    let coverageReporters: string[];
    let testTimeout: number;
    let moduleFileExtensions: string[];
    let testPathIgnorePatterns: string[];
    let resolver: undefined;
    let verbose: boolean;
}
export default _default;
//# sourceMappingURL=jest.esm.config.d.ts.map