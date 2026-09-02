/**
 * Domain models for the APIVerify application.
 * Shared across main (Node) and renderer (React) processes.
 */

/**
 * Represents a workspace containing API specifications and configurations.
 */
export interface Project {
  id: string;
  name: string;
  userId?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Local user profile for the desktop application.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Environment configuration storing variables for URL/header interpolation.
 */
export interface Environment {
  id: string;
  projectId: string;
  name: string;
  variables: Record<string, string>;
  type: 'DEV' | 'QA' | 'UAT' | 'PROD' | 'Custom';
  baseUrl: string;
  defaultHeaders: HeaderOrQueryParam[];
  authConfig: ApiAuthConfig;
  isActive: boolean;
  createdAt?: string;
}

/**
 * Authentication types supported by the validator.
 */
export type AuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'apiKey' | 'custom' | 'oauth2' | 'aws';

/**
 * Configuration schema for API request authentication.
 */
export interface ApiAuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  addTo?: 'header' | 'query';
  customHeaders?: Array<{ key: string; value: string; enabled: boolean }>;
  /** OAuth2 client-credentials token endpoint (used with basic username/password as client id/secret). */
  tokenUrl?: string;
  /** Unix timestamp (ms) when the stored OAuth access token expires. */
  tokenExpiresAt?: number;
}

/**
 * HTTP methods supported for endpoint validation.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type ValidationRunSource = 'manual' | 'scheduler';

/**
 * API Specification (e.g. Swagger/OpenAPI JSON or YAML).
 */
export interface ApiSpec {
  id: string;
  projectId: string;
  name: string;
  content: string;
  createdAt?: string;
}

/**
 * Key-value pair configuration with enablement state.
 */
export interface HeaderOrQueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * Represents a configured API endpoint.
 */
export interface ApiEndpoint {
  id: string;
  projectId: string;
  name: string;
  path: string;
  method: HttpMethod;
  headers: HeaderOrQueryParam[];
  queryParams: HeaderOrQueryParam[];
  body: string | null;
  authConfig: ApiAuthConfig;
  /** Explicit test values for OpenAPI path parameters (e.g. { id: "42" }) */
  pathVariables?: Record<string, string>;
  createdAt?: string;
}

/**
 * Detail of a specific validation error violating the schema contract.
 */
export interface ValidationError {
  id: string;
  path?: string; // JSON Pointer path where error occurred (e.g. "/body/email")
  keyword?: string; // AJV keyword validation identifier (e.g. "required", "type")
  message: string; // Readable message explaining the schema violation
  severity: 'high' | 'medium' | 'low';
  receivedValue?: unknown; // Value that was received from request response
  expectedSchema?: unknown; // Schema structure that was expected
}

/**
 * Telemetry details of a single API validation execution run.
 */
export interface ValidationRun {
  id: string;
  projectId: string;
  url: string;
  method: string;
  headers: string; // JSON string
  body: string | null;
  runSource?: ValidationRunSource;
  batchId?: string;
  createdAt?: string;
}

export interface ValidationResult {
  id: string;
  runId: string;
  responseStatus: number;
  responseHeaders: string; // JSON string
  responseBody: string | null;
  validationErrors: string | null; // JSON string
  responseTimeMs?: number; // Execution time in milliseconds
  createdAt?: string;
}

/**
 * Encapsulates the complete result of an engine execution run.
 */
export interface EngineExecutionResult {
  run: ValidationRun;
  result: ValidationResult;
}

/**
 * Aggregated validation performance and compliance reporting model.
 */
export interface Report {
  id: string;
  projectId: string;
  name: string;
  generatedAt: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  complianceRate: number; // Percentage of passed validation runs
  avgLatencyMs: number;
  endpointsTestedCount: number;
  topViolations: Array<{
    endpointPath: string;
    method: HttpMethod;
    errorCount: number;
    commonIssue: string;
  }>;
}
