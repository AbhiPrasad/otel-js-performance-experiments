export interface TestScenario {
    name: string;
    description: string;
    endpoint: string;
    method: 'GET' | 'POST';
    body?: object;
}
export interface InstrumentationMode {
    name: string;
    description: string;
    envVars: Record<string, string>;
}
export interface BenchmarkPreset {
    connections: number;
    duration: number;
    pipelining: number;
    warmup: {
        duration: number;
        connections: number;
    };
}
export declare const SCENARIOS: TestScenario[];
export declare const INSTRUMENTATION_MODES: InstrumentationMode[];
export declare const BENCHMARK_PRESETS: Record<string, BenchmarkPreset>;
//# sourceMappingURL=scenarios.d.ts.map