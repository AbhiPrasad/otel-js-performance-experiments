export interface GitConfig {
  otelJsPath: string;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
}

export interface TagInfo {
  name: string;
  commit: string;
  date: string;
}

export interface BuildConfig {
  otelJsPath: string;
  targetPackages?: string[];
}

export interface LinkConfig {
  otelJsPath: string;
  testAppPath: string;
}

export const DEFAULT_TARGET_PACKAGES = [
  '@opentelemetry/api',
  '@opentelemetry/core',
  '@opentelemetry/resources',
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/sdk-trace-node',
  '@opentelemetry/semantic-conventions',
  '@opentelemetry/sdk-node',
  '@opentelemetry/instrumentation',
  '@opentelemetry/instrumentation-http',
];

export const PACKAGE_LOCATIONS: Record<string, string> = {
  '@opentelemetry/api': 'api',
  '@opentelemetry/core': 'packages/opentelemetry-core',
  '@opentelemetry/resources': 'packages/opentelemetry-resources',
  '@opentelemetry/sdk-trace-base': 'packages/opentelemetry-sdk-trace-base',
  '@opentelemetry/sdk-trace-node': 'packages/opentelemetry-sdk-trace-node',
  '@opentelemetry/semantic-conventions': 'semantic-conventions',
  '@opentelemetry/sdk-node': 'experimental/packages/opentelemetry-sdk-node',
  '@opentelemetry/instrumentation': 'experimental/packages/opentelemetry-instrumentation',
  '@opentelemetry/instrumentation-http': 'experimental/packages/opentelemetry-instrumentation-http',
  '@opentelemetry/exporter-trace-otlp-http': 'experimental/packages/exporter-trace-otlp-http',
};
