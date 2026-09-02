import type { ApiSpec, Environment, Project } from './index'

export const EXPORT_FORMAT = 'apiverify-export' as const
export const EXPORT_VERSION = 1 as const

export type ExportScopeType =
  | 'all-workspaces'
  | 'workspace'
  | 'environments'
  | 'environment'
  | 'specs'
  | 'spec'

export interface WorkspaceExportBundle {
  project: Project
  environments: Environment[]
  specs: ApiSpec[]
}

export interface ConfigurationExportBundle {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_VERSION
  exportedAt: string
  scope: ExportScopeType
  workspaces: WorkspaceExportBundle[]
}

export type ExportConfigurationInput =
  | { scope: 'all-workspaces'; userId: string }
  | { scope: 'workspace'; projectId: string }
  | { scope: 'environments'; projectId: string }
  | { scope: 'environment'; environmentId: string }
  | { scope: 'specs'; projectId: string }
  | { scope: 'spec'; specId: string }

export interface ExportSaveResult {
  saved: boolean
  filePath?: string
}
