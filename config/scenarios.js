export const SCENARIOS = [
    {
        name: 'simple-json',
        description: 'Simple JSON response (minimal processing)',
        endpoint: '/api/simple',
        method: 'GET',
    },
    {
        name: 'async-io-50ms',
        description: 'Simulated async I/O with 50ms delay',
        endpoint: '/api/async/50',
        method: 'GET',
    },
    {
        name: 'async-io-100ms',
        description: 'Simulated async I/O with 100ms delay',
        endpoint: '/api/async/100',
        method: 'GET',
    },
    {
        name: 'cpu-work-light',
        description: 'Light CPU-bound work (fibonacci calculation)',
        endpoint: '/api/cpu/light',
        method: 'GET',
    },
    {
        name: 'cpu-work-heavy',
        description: 'Heavy CPU-bound work',
        endpoint: '/api/cpu/heavy',
        method: 'GET',
    },
    {
        name: 'external-http-single',
        description: 'Single external HTTP call (to mock server)',
        endpoint: '/api/external/single',
        method: 'GET',
    },
    {
        name: 'external-http-parallel',
        description: 'Multiple parallel external HTTP calls',
        endpoint: '/api/external/parallel',
        method: 'GET',
    },
    {
        name: 'external-http-sequential',
        description: 'Multiple sequential external HTTP calls',
        endpoint: '/api/external/sequential',
        method: 'GET',
    },
    {
        name: 'nested-spans',
        description: 'Endpoint that creates nested manual spans',
        endpoint: '/api/spans/nested',
        method: 'GET',
    },
    {
        name: 'post-json-small',
        description: 'POST with small JSON body',
        endpoint: '/api/data',
        method: 'POST',
        body: { message: 'test' },
    },
];
export const INSTRUMENTATION_MODES = [
    {
        name: 'baseline',
        description: 'No OpenTelemetry instrumentation',
        envVars: { OTEL_ENABLED: 'false' },
    },
    {
        name: 'otel-noop',
        description: 'OTel tracing with NoopSpanProcessor (measures SDK overhead)',
        envVars: {
            OTEL_ENABLED: 'true',
            OTEL_EXPORTER: 'noop',
        },
    },
    {
        name: 'otel-console',
        description: 'OTel tracing with ConsoleSpanExporter',
        envVars: {
            OTEL_ENABLED: 'true',
            OTEL_EXPORTER: 'console',
        },
    },
    {
        name: 'otel-otlp-http',
        description: 'OTel tracing with OTLP HTTP exporter',
        envVars: {
            OTEL_ENABLED: 'true',
            OTEL_EXPORTER: 'otlp-http',
            OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
        },
    },
];
export const BENCHMARK_PRESETS = {
    quick: {
        connections: 10,
        duration: 10,
        pipelining: 1,
        warmup: { duration: 3, connections: 5 },
    },
    standard: {
        connections: 50,
        duration: 30,
        pipelining: 1,
        warmup: { duration: 5, connections: 10 },
    },
    stress: {
        connections: 100,
        duration: 60,
        pipelining: 1,
        warmup: { duration: 10, connections: 20 },
    },
    sustained: {
        connections: 25,
        duration: 300,
        pipelining: 1,
        warmup: { duration: 10, connections: 10 },
    },
};
//# sourceMappingURL=scenarios.js.map