import { writeFileSync } from 'fs'
import { dialog, BrowserWindow } from 'electron'
import { appErrorFromCode } from '../../shared/errors'
import type {
  ConfigurationExportBundle,
  ExportConfigurationInput,
  ExportSaveResult,
  WorkspaceExportBundle,
} from '../../shared/models/export'
import { EXPORT_FORMAT, EXPORT_VERSION } from '../../shared/models/export'
import { ProjectRepository } from '../db/repositories/ProjectRepository'
import { EnvironmentRepository } from '../db/repositories/EnvironmentRepository'
import { ApiSpecRepository } from '../db/repositories/ApiSpecRepository'

const projectRepo = new ProjectRepository()
const envRepo = new EnvironmentRepository()
const specRepo = new ApiSpecRepository()

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'export'
}

function buildWorkspaceBundle(projectId: string): WorkspaceExportBundle {
  const project = projectRepo.findById(projectId)
  if (!project) {
    throw appErrorFromCode('VALIDATION', 'Workspace not found.', { retryable: false })
  }

  return {
    project,
    environments: envRepo.findByProjectId(projectId),
    specs: specRepo.findByProjectId(projectId),
  }
}

export function buildExportBundle(input: ExportConfigurationInput): ConfigurationExportBundle {
  const exportedAt = new Date().toISOString()

  switch (input.scope) {
    case 'all-workspaces': {
      const projects = projectRepo.findByUserId(input.userId)
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt,
        scope: input.scope,
        workspaces: projects.map((project) => buildWorkspaceBundle(project.id)),
      }
    }
    case 'workspace': {
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt,
        scope: input.scope,
        workspaces: [buildWorkspaceBundle(input.projectId)],
      }
    }
    case 'environments': {
      const bundle = buildWorkspaceBundle(input.projectId)
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt,
        scope: input.scope,
        workspaces: [{ ...bundle, specs: [] }],
      }
    }
    case 'environment': {
      const environment = envRepo.findById(input.environmentId)
      if (!environment) {
        throw appErrorFromCode('VALIDATION', 'Environment not found.', { retryable: false })
      }
      const bundle = buildWorkspaceBundle(environment.projectId)
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt,
        scope: input.scope,
        workspaces: [{ ...bundle, environments: [environment], specs: [] }],
      }
    }
    case 'specs': {
      const bundle = buildWorkspaceBundle(input.projectId)
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt,
        scope: input.scope,
        workspaces: [{ ...bundle, environments: [] }],
      }
    }
    case 'spec': {
      const spec = specRepo.findById(input.specId)
      if (!spec) {
        throw appErrorFromCode('VALIDATION', 'API specification not found.', { retryable: false })
      }
      const bundle = buildWorkspaceBundle(spec.projectId)
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt,
        scope: input.scope,
        workspaces: [{ ...bundle, environments: [], specs: [spec] }],
      }
    }
  }
}

function defaultFilename(input: ExportConfigurationInput, bundle: ConfigurationExportBundle): string {
  const workspace = bundle.workspaces[0]

  switch (input.scope) {
    case 'all-workspaces':
      return 'apiverify-all-workspaces.json'
    case 'workspace':
      return `apiverify-workspace-${sanitizeFilename(workspace.project.name)}.json`
    case 'environments':
      return `apiverify-environments-${sanitizeFilename(workspace.project.name)}.json`
    case 'environment':
      return `apiverify-environment-${sanitizeFilename(workspace.environments[0]?.name ?? 'environment')}.json`
    case 'specs':
      return `apiverify-specs-${sanitizeFilename(workspace.project.name)}.json`
    case 'spec':
      return `apiverify-spec-${sanitizeFilename(workspace.specs[0]?.name ?? 'spec')}.json`
  }
}

export async function saveConfigurationExport(input: ExportConfigurationInput): Promise<ExportSaveResult> {
  const bundle = buildExportBundle(input)
  const defaultPath = defaultFilename(input, bundle)
  const parentWindow = BrowserWindow.getFocusedWindow()
  const dialogOptions = {
    title: 'Export configuration',
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  }

  const { canceled, filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions)

  if (canceled || !filePath) {
    return { saved: false }
  }

  writeFileSync(filePath, JSON.stringify(bundle, null, 2), 'utf-8')
  return { saved: true, filePath }
}
