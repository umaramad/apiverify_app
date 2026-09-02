import { create } from 'zustand'
import type { AppErrorPayload } from '../../../shared/errors'
import { toAppError, normalizeHttpError } from '../../../shared/errors'
import { reportError } from './error.store'
import type {
  Project,
  ApiSpec,
  Environment,
  ValidationRun,
  ValidationResult,
  ApiAuthConfig,
  User
} from '../../../shared/models'
import type { ManualRequest } from '../../../shared/manualCollection'
import {
  createManualCollectionContent,
  addOrUpdateManualRequest,
  removeManualRequest,
  buildManualCollectionFromEndpoints,
  updateManualCollectionOrder,
  updateManualCollectionVariables,
  extractManualRequests,
  isManualCollection,
  manualRequestToEndpoint,
  endpointToManualRequest,
  findManualOpenApiPathForValidation,
  findManualRequestForActiveRequest
} from '../../../shared/manualCollection'
import type { ApiEndpoint } from '../../../shared/models'
import type { CollectionVariable, VariableExtractor } from '../../../shared/collectionVariables'
import {
  applyVariableExtractors,
  buildCollectionVariableMap,
  extractCollectionVariables,
  getExtractedVariableValues
} from '../../../shared/collectionVariables'
import { previewExtractorValue } from '../../../shared/responseVariableSuggestions'
import { buildRequest, getExplicitCollectionServerUrl } from '../../../shared/engine/requestBuilder'
import { resolveEditorRequest } from '../../../shared/engine/resolveEditorRequest'
import {
  extractEndpointsFromSpec,
  getSpecParametersForEndpoint
} from '../../../shared/engine/endpointExtractor'
import { endpointOrderKey } from '../../../shared/manualCollectionOrder'
import type {
  SaveValidationScheduleInput,
  ValidationSchedule
} from '../../../shared/models/scheduler'
import type { ExportConfigurationInput, ExportSaveResult } from '../../../shared/models/export'

// We will map ValidationRun and ValidationResult to a HistoryEntry for the UI,
// or just use ValidationRun and fetch ValidationResult when selected.
// For now, let's keep the UI compatible with the old HistoryEntry, or adapt it.
export type HistoryEntry = ValidationRun & {
  // We can attach result if we want, but for now we'll just keep the run
  validationResult?: ValidationResult
}

interface RequestState {
  url: string
  method: string
  headers: Array<{ key: string; value: string; enabled: boolean }>
  queryParams: Array<{ key: string; value: string; enabled: boolean }>
  body: string
  auth: ApiAuthConfig
}

interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
  loading: boolean
  error: string | null
  errorPayload: AppErrorPayload | null
}

interface ValidationState {
  valid: boolean
  errors?: Array<{
    instancePath: string
    schemaPath: string
    keyword: string
    params: Record<string, any>
    message?: string
  }>
  message?: string
}

interface CollectionRunLogEntry {
  status: 'info' | 'success' | 'error'
  message: string
}

interface AppStore {
  // User profile
  currentUser: User | null

  // Projects
  projects: Project[]
  activeProjectId: string | null

  // Specs
  specs: ApiSpec[]
  activeSpecId: string | null
  parsedSpec: any | null // Dereferenced spec object

  // Environments
  environments: Environment[]
  activeEnvId: string | null

  // History
  history: HistoryEntry[]

  // Schedules
  schedules: ValidationSchedule[]

  // Active Request/Response
  request: RequestState
  response: ResponseState
  validation: ValidationState | null

  collectionRuntimeVariables: Record<string, string>
  collectionChainVariables: Record<string, string>
  collectionRunStatus: 'idle' | 'running'
  collectionRunLogs: CollectionRunLogEntry[]
  activeManualRequestKey: string | null
  collectionWorkspaceFocus: number

  // Actions
  init: () => Promise<void>
  loadCurrentUser: () => Promise<User | null>
  saveUserProfile: (name: string, email: string) => Promise<void>
  loadProjects: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  createProject: (name: string) => Promise<void>
  updateProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Specs Actions
  loadSpecs: () => Promise<void>
  selectSpec: (specId: string | null) => Promise<void>
  importSpec: (
    name: string,
    content: string
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  createManualCollection: (
    name: string,
    baseUrl?: string
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  saveEndpointsAsCollection: (
    name: string,
    endpoints: ApiEndpoint[],
    baseUrl?: string
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  addEndpointsToManualCollection: (
    specId: string,
    endpoints: ApiEndpoint[]
  ) => Promise<{
    success: boolean
    error?: string
    errorPayload?: AppErrorPayload
    addedCount?: number
    skippedCount?: number
  }>
  saveImportedSelectionAsCollection: (
    name: string,
    parsedSpec: Record<string, unknown>,
    orderedKeys: string[],
    selectedKeys: string[]
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  updateSpecContent: (
    specId: string,
    content: string
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  saveManualRequest: (
    specId: string,
    request: ManualRequest,
    original?: { path: string; method: ManualRequest['method'] }
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  deleteManualRequest: (
    specId: string,
    path: string,
    method: ManualRequest['method']
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  saveManualCollectionOrder: (
    specId: string,
    order: string[]
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  saveCollectionVariables: (
    specId: string,
    variables: CollectionVariable[]
  ) => Promise<{ success: boolean; error?: string; errorPayload?: AppErrorPayload }>
  deleteSpec: (id: string) => Promise<void>

  // Environments Actions
  loadEnvironments: () => Promise<void>
  saveEnvironment: (env: Omit<Environment, 'createdAt'>) => Promise<void>
  deleteEnvironment: (id: string) => Promise<void>
  setActiveEnvironment: (id: string | null) => Promise<void>

  // Request State Actions
  updateRequest: (req: Partial<RequestState>) => void
  selectManualCollectionRequest: (key: string) => void
  refreshVariablesAfterExecution: (
    manualRequest: ManualRequest,
    response: { status: number; headers: Record<string, string>; data: unknown },
    options?: { persistEnvironment?: boolean }
  ) => Promise<void>
  sendRequest: () => Promise<void>
  runCollection: () => Promise<void>
  resetCollectionVariables: () => void
  addPostVariablesFromResponse: (
    extractors: VariableExtractor[],
    environmentEntries?: Array<{ name: string; value: string }>
  ) => Promise<{ success: boolean; error?: string; message?: string }>
  clearHistory: () => Promise<void>
  deleteValidationSession: (runIds: string[]) => Promise<void>
  reloadHistory: () => Promise<void>

  loadSchedules: () => Promise<void>
  saveSchedule: (input: Omit<SaveValidationScheduleInput, 'userId'>) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>

  exportConfiguration: (input: ExportConfigurationInput) => Promise<ExportSaveResult>

  // Theme Mode Action
  themeMode: 'dark' | 'light'
  setThemeMode: (mode: 'dark' | 'light') => void

  // Active Navigation
  activePage:
    | 'home'
    | 'dashboard'
    | 'projects'
    | 'environments'
    | 'apis'
    | 'runner'
    | 'scheduler'
    | 'results'
    | 'reports'
    | 'linuxSearchAssistant'
    | 'localLogViewer'
    | 'settings'
  setActivePage: (
    page:
      | 'home'
      | 'dashboard'
      | 'projects'
      | 'environments'
      | 'apis'
      | 'runner'
      | 'scheduler'
      | 'results'
      | 'reports'
      | 'linuxSearchAssistant'
      | 'localLogViewer'
      | 'settings'
  ) => void

  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
}

export type ActivePage = AppStore['activePage']

const SIDEBAR_COLLAPSED_KEY = 'apverify-sidebar-collapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  } catch {
    // ignore storage errors
  }
}

function normalizeRequestPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

// Helper to generate UUIDs in renderer
function generateUUID(): string {
  return crypto.randomUUID()
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentUser: null,
  projects: [],
  activeProjectId: null,
  specs: [],
  activeSpecId: null,
  parsedSpec: null,
  environments: [],
  activeEnvId: null,
  history: [],
  schedules: [],
  themeMode: 'dark',
  setThemeMode: (mode) => set({ themeMode: mode }),
  activePage: 'home',
  setActivePage: (page) => set({ activePage: page }),
  sidebarCollapsed: readSidebarCollapsed(),
  setSidebarCollapsed: (collapsed) => {
    writeSidebarCollapsed(collapsed)
    set({ sidebarCollapsed: collapsed })
  },
  toggleSidebarCollapsed: () => {
    const collapsed = !get().sidebarCollapsed
    writeSidebarCollapsed(collapsed)
    set({ sidebarCollapsed: collapsed })
  },

  request: {
    url: '',
    method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    queryParams: [],
    body: '',
    auth: { type: 'inherit' }
  },

  response: {
    status: 0,
    statusText: '',
    headers: {},
    data: null,
    loading: false,
    error: null,
    errorPayload: null
  },

  validation: null,
  collectionRuntimeVariables: {},
  collectionChainVariables: {},
  collectionRunStatus: 'idle',
  collectionRunLogs: [],
  activeManualRequestKey: null,
  collectionWorkspaceFocus: 0,

  init: async () => {
    try {
      await get().loadCurrentUser()
      const { currentUser } = get()
      if (!currentUser) {
        set({
          projects: [],
          activeProjectId: null,
          specs: [],
          environments: [],
          history: []
        })
        return
      }

      await get().loadProjects()
      const { projects } = get()
      if (projects.length === 0) {
        const id = generateUUID()
        await window.api.createProject({
          id,
          name: 'Default Workspace',
          userId: currentUser.id
        } as Project)
        await get().loadProjects()
      }
      const updatedProjects = get().projects
      if (updatedProjects.length > 0) {
        await get().selectProject(updatedProjects[0].id)
      }
      await get().loadSchedules()
    } catch (error) {
      reportError(error)
    }
  },

  loadCurrentUser: async () => {
    const user = await window.api.getCurrentUser()
    set({ currentUser: user })
    return user
  },

  saveUserProfile: async (name, email) => {
    try {
      const { currentUser } = get()
      if (currentUser) {
        const updated = await window.api.updateUser(currentUser.id, name, email)
        set({ currentUser: updated })
        return
      }

      const id = generateUUID()
      await window.api.createUser({ id, name, email })
      await window.api.assignProjectsToUser(id)
      const user = await window.api.getCurrentUser()
      set({ currentUser: user })

      await get().loadProjects()
      const { projects, activeProjectId } = get()
      if (projects.length === 0) {
        await get().createProject('Default Workspace')
      } else if (!activeProjectId) {
        await get().selectProject(projects[0].id)
      }
    } catch (error) {
      reportError(error)
      throw error
    }
  },

  loadProjects: async () => {
    const { currentUser } = get()
    if (!currentUser) {
      set({ projects: [] })
      return
    }
    const list = await window.api.getProjects(currentUser.id)
    set({ projects: list })
  },

  selectProject: async (projectId) => {
    try {
      set({ activeProjectId: projectId, activeSpecId: null, parsedSpec: null })
      await get().loadSpecs()
      await get().loadEnvironments()
      const runs = await window.api.getValidationRuns(projectId)
      set({ history: runs })
    } catch (error) {
      reportError(error)
    }
  },

  createProject: async (name) => {
    const { currentUser } = get()
    if (!currentUser) {
      reportError(new Error('Create your profile in Settings before adding workspaces.'))
      return
    }

    const id = generateUUID()
    await window.api.createProject({ id, name, userId: currentUser.id } as Project)
    await get().loadProjects()
    await get().selectProject(id)
  },

  updateProject: async (id, name) => {
    await window.api.updateProject(id, name)
    await get().loadProjects()
  },

  deleteProject: async (id) => {
    await window.api.deleteProject(id)
    await get().loadProjects()
    const { projects } = get()
    if (projects.length > 0) {
      await get().selectProject(projects[0].id)
    } else {
      set({ activeProjectId: null, specs: [], environments: [], history: [] })
    }
  },

  loadSpecs: async () => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    const list = await window.api.getSpecsForProject(activeProjectId)
    set({ specs: list })
  },

  selectSpec: async (specId) => {
    if (!specId) {
      set({
        activeSpecId: null,
        parsedSpec: null,
        collectionRuntimeVariables: {},
        collectionChainVariables: {},
        collectionRunLogs: [],
        collectionRunStatus: 'idle'
      })
      return
    }
    const spec = get().specs.find((s) => s.id === specId)
    if (!spec) return

    const parseResult = await window.api.parseSpecContent(spec.content)
    if (parseResult.valid) {
      set({ activeSpecId: specId, parsedSpec: parseResult.spec })
      get().resetCollectionVariables()
    } else {
      console.error('Failed to parse spec:', parseResult.error)
      set({
        activeSpecId: specId,
        parsedSpec: null,
        collectionRuntimeVariables: {},
        collectionChainVariables: {},
        collectionRunLogs: [],
        collectionRunStatus: 'idle'
      })
    }
  },

  importSpec: async (name, content) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return { success: false, error: 'No active project' }

    // Parse to check validity before saving
    const parseResult = await window.api.parseSpecContent(content)
    if (!parseResult.valid) {
      return {
        success: false,
        error: parseResult.error || 'Unknown parsing error',
        errorPayload: parseResult.errorPayload
      }
    }

    try {
      const specId = generateUUID()
      await window.api.saveSpec({
        id: specId,
        projectId: activeProjectId,
        name,
        content
      })

      await get().loadSpecs()
      await get().selectSpec(specId)
      return { success: true }
    } catch (error) {
      const appError = toAppError(error)
      return { success: false, error: appError.message, errorPayload: appError.toPayload() }
    }
  },

  createManualCollection: async (name, baseUrl) => {
    const content = createManualCollectionContent(name, baseUrl)
    return get().importSpec(name.trim() || 'Manual Collection', content)
  },

  saveEndpointsAsCollection: async (name, endpoints, baseUrl) => {
    if (endpoints.length === 0) {
      return { success: false, error: 'Select at least one API to save.' }
    }

    try {
      const content = buildManualCollectionFromEndpoints(name, endpoints, baseUrl)
      return get().importSpec(name.trim() || 'Runner Collection', content)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to build collection.'
      }
    }
  },

  addEndpointsToManualCollection: async (specId, endpoints) => {
    const spec = get().specs.find((s) => s.id === specId)
    if (!spec) return { success: false, error: 'Manual collection not found.' }
    if (endpoints.length === 0) {
      return { success: false, error: 'Select at least one API to add.' }
    }

    try {
      let content = spec.content
      const parsedSpec = JSON.parse(content) as Record<string, unknown>
      const existingKeys = new Set(
        extractManualRequests(parsedSpec).map((request) =>
          endpointOrderKey(request.method, normalizeRequestPath(request.path))
        )
      )
      let addedCount = 0
      let skippedCount = 0

      for (const endpoint of endpoints) {
        const key = endpointOrderKey(endpoint.method, normalizeRequestPath(endpoint.path))
        if (existingKeys.has(key)) {
          skippedCount += 1
          continue
        }
        content = addOrUpdateManualRequest(content, endpointToManualRequest(endpoint))
        existingKeys.add(key)
        addedCount += 1
      }

      if (addedCount === 0) {
        return { success: true, addedCount, skippedCount }
      }

      const result = await get().updateSpecContent(specId, content)
      return result.success ? { ...result, addedCount, skippedCount } : result
    } catch (error) {
      const appError = toAppError(error)
      return { success: false, error: appError.message, errorPayload: appError.toPayload() }
    }
  },

  saveImportedSelectionAsCollection: async (name, parsedSpec, orderedKeys, selectedKeys) => {
    const { activeProjectId } = get()
    if (!activeProjectId) {
      return { success: false, error: 'No active project' }
    }
    if (selectedKeys.length === 0) {
      return { success: false, error: 'Select at least one API to save.' }
    }

    const endpoints = extractEndpointsFromSpec(activeProjectId, parsedSpec, {
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    })
    const endpointMap = new Map(
      endpoints.map((endpoint) => [endpointOrderKey(endpoint.method, endpoint.path), endpoint])
    )
    const selectedEndpoints = orderedKeys
      .filter((key) => selectedKeys.includes(key))
      .map((key) => endpointMap.get(key))
      .filter((endpoint): endpoint is ApiEndpoint => endpoint !== undefined)

    return get().saveEndpointsAsCollection(name, selectedEndpoints)
  },

  updateSpecContent: async (specId, content) => {
    const { activeProjectId, specs } = get()
    const spec = specs.find((s) => s.id === specId)
    if (!spec || !activeProjectId) return { success: false, error: 'Specification not found' }

    const parseResult = await window.api.parseSpecContent(content)
    if (!parseResult.valid) {
      return {
        success: false,
        error: parseResult.error || 'Unknown parsing error',
        errorPayload: parseResult.errorPayload
      }
    }

    try {
      await window.api.saveSpec({
        id: spec.id,
        projectId: spec.projectId,
        name: spec.name,
        content
      })
      await get().loadSpecs()
      if (get().activeSpecId === specId) {
        await get().selectSpec(specId)
      }
      return { success: true }
    } catch (error) {
      const appError = toAppError(error)
      return { success: false, error: appError.message, errorPayload: appError.toPayload() }
    }
  },

  saveManualRequest: async (specId, request, original) => {
    const spec = get().specs.find((s) => s.id === specId)
    if (!spec) return { success: false, error: 'Specification not found' }

    try {
      const content = addOrUpdateManualRequest(spec.content, request, original)
      return get().updateSpecContent(specId, content)
    } catch (error) {
      const appError = toAppError(error)
      return { success: false, error: appError.message, errorPayload: appError.toPayload() }
    }
  },

  deleteManualRequest: async (specId, path, method) => {
    const spec = get().specs.find((s) => s.id === specId)
    if (!spec) return { success: false, error: 'Specification not found' }

    const content = removeManualRequest(spec.content, path, method)
    return get().updateSpecContent(specId, content)
  },

  saveManualCollectionOrder: async (specId, order) => {
    const spec = get().specs.find((s) => s.id === specId)
    if (!spec) return { success: false, error: 'Specification not found' }

    try {
      const content = updateManualCollectionOrder(spec.content, order)
      return get().updateSpecContent(specId, content)
    } catch (error) {
      const appError = toAppError(error)
      return { success: false, error: appError.message, errorPayload: appError.toPayload() }
    }
  },

  saveCollectionVariables: async (specId, variables) => {
    const spec = get().specs.find((s) => s.id === specId)
    if (!spec) return { success: false, error: 'Specification not found' }

    try {
      const content = updateManualCollectionVariables(spec.content, variables)
      const result = await get().updateSpecContent(specId, content)
      if (result.success) {
        get().resetCollectionVariables()
      }
      return result
    } catch (error) {
      const appError = toAppError(error)
      return { success: false, error: appError.message, errorPayload: appError.toPayload() }
    }
  },

  deleteSpec: async (id) => {
    await window.api.deleteSpec(id)
    const { activeSpecId } = get()
    await get().loadSpecs()
    if (activeSpecId === id) {
      set({ activeSpecId: null, parsedSpec: null })
    }
  },

  loadEnvironments: async () => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    const list = await window.api.getEnvironmentsForProject(activeProjectId)
    set({ environments: list })
    const active = list.find((e) => e.isActive)
    set({ activeEnvId: active ? active.id : null })
  },

  saveEnvironment: async (env) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    await window.api.saveEnvironment({
      id: env.id,
      projectId: activeProjectId,
      name: env.name,
      variables: env.variables,
      isActive: env.isActive,
      type: env.type,
      baseUrl: env.baseUrl,
      defaultHeaders: env.defaultHeaders,
      authConfig: env.authConfig
    } as Environment)
    await get().loadEnvironments()
  },

  deleteEnvironment: async (id) => {
    await window.api.deleteEnvironment(id)
    await get().loadEnvironments()
  },

  setActiveEnvironment: async (id) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    await window.api.setActiveEnvironment(activeProjectId, id)
    await get().loadEnvironments()
  },

  updateRequest: (updatedFields) => {
    set((state) => ({
      request: { ...state.request, ...updatedFields }
    }))
  },

  selectManualCollectionRequest: (key) => {
    set((state) => ({
      activeManualRequestKey: key,
      collectionWorkspaceFocus: state.collectionWorkspaceFocus + 1,
      response: {
        status: 0,
        statusText: '',
        headers: {},
        data: null,
        loading: false,
        error: null,
        errorPayload: null
      },
      validation: null
    }))
  },

  refreshVariablesAfterExecution: async (manualRequest, response, options) => {
    const extractors = manualRequest.extractors ?? []
    if (extractors.length === 0 || response.status <= 0) return

    const { activeEnvId, parsedSpec } = get()
    if (!parsedSpec || !isManualCollection(parsedSpec)) return

    const chainVariables = applyVariableExtractors(
      extractors,
      response,
      get().collectionChainVariables
    )
    const extracted = getExtractedVariableValues(extractors, response)

    let environment = activeEnvId
      ? get().environments.find((env) => env.id === activeEnvId)
      : undefined
    const shouldPersistEnvironment = options?.persistEnvironment !== false

    if (environment && shouldPersistEnvironment && Object.keys(extracted).length > 0) {
      await get().saveEnvironment({
        ...environment,
        variables: { ...environment.variables, ...extracted }
      })
      environment = get().environments.find((env) => env.id === activeEnvId)
    }

    if (!environment) {
      set({ collectionChainVariables: chainVariables })
      return
    }

    set({
      collectionChainVariables: chainVariables,
      collectionRuntimeVariables: buildCollectionVariableMap(
        environment,
        extractCollectionVariables(parsedSpec),
        chainVariables,
        getExplicitCollectionServerUrl(parsedSpec)
      )
    })
  },

  resetCollectionVariables: () => {
    const { parsedSpec, activeEnvId, environments } = get()
    if (!parsedSpec || !isManualCollection(parsedSpec) || !activeEnvId) {
      set({
        collectionRuntimeVariables: {},
        collectionChainVariables: {},
        collectionRunLogs: [],
        collectionRunStatus: 'idle'
      })
      return
    }

    const environment = environments.find((env) => env.id === activeEnvId)
    if (!environment) {
      set({
        collectionRuntimeVariables: {},
        collectionChainVariables: {},
        collectionRunLogs: [],
        collectionRunStatus: 'idle'
      })
      return
    }

    const variableMap = buildCollectionVariableMap(
      environment,
      extractCollectionVariables(parsedSpec),
      {},
      getExplicitCollectionServerUrl(parsedSpec)
    )
    set({
      collectionRuntimeVariables: variableMap,
      collectionChainVariables: {},
      collectionRunLogs: [],
      collectionRunStatus: 'idle'
    })
  },

  addPostVariablesFromResponse: async (extractors, environmentEntries = []) => {
    const { parsedSpec, activeSpecId, activeEnvId, request, response } = get()
    if (!parsedSpec || !activeSpecId || !isManualCollection(parsedSpec)) {
      return { success: false, error: 'Select a manual collection request first.' }
    }
    if (extractors.length === 0 && environmentEntries.length === 0) {
      return { success: false, error: 'No variables selected.' }
    }

    const manualRequest = findManualRequestForActiveRequest(
      parsedSpec,
      request,
      get().activeManualRequestKey
    )
    if (!manualRequest) {
      return {
        success: false,
        error: 'Could not match this response to a request in the collection.'
      }
    }

    let savedPostVariables = 0
    let updatedRequest = manualRequest

    if (extractors.length > 0) {
      const existing = manualRequest.extractors ?? []
      const merged = [...existing]
      for (const extractor of extractors) {
        const index = merged.findIndex((item) => item.name.trim() === extractor.name.trim())
        if (index >= 0) {
          merged[index] = { ...merged[index], ...extractor, enabled: true }
        } else {
          merged.push(extractor)
        }
      }

      updatedRequest = {
        ...manualRequest,
        extractors: merged
      }

      const saveResult = await get().saveManualRequest(activeSpecId, updatedRequest, {
        path: manualRequest.path,
        method: manualRequest.method
      })
      if (!saveResult.success) {
        return { success: false, error: saveResult.error ?? 'Failed to save post-variables.' }
      }
      savedPostVariables = extractors.length
    }

    let savedEnvironmentVariables = 0
    const environment = activeEnvId
      ? get().environments.find((env) => env.id === activeEnvId)
      : undefined

    if (environment && environmentEntries.length > 0) {
      const nextVariables = { ...environment.variables }
      for (const entry of environmentEntries) {
        const name = entry.name.trim()
        if (!name) continue

        let value = entry.value
        const extractor = extractors.find((item) => item.name.trim() === name)
        if (extractor && response.status > 0) {
          const extracted = previewExtractorValue(response.data, response.headers, extractor)
          if (extracted !== undefined) {
            value = extracted
          }
        }

        nextVariables[name] = value
        savedEnvironmentVariables += 1
      }

      await get().saveEnvironment({
        ...environment,
        variables: nextVariables
      })
    }

    if (response.status > 0 && (updatedRequest.extractors?.length ?? 0) > 0) {
      await get().refreshVariablesAfterExecution(updatedRequest, {
        status: response.status,
        headers: response.headers,
        data: response.data
      })
    }

    const parts: string[] = []
    if (savedPostVariables > 0) {
      parts.push(`${savedPostVariables} post-variable${savedPostVariables === 1 ? '' : 's'}`)
    }
    if (savedEnvironmentVariables > 0) {
      parts.push(
        `${savedEnvironmentVariables} environment variable${savedEnvironmentVariables === 1 ? '' : 's'}`
      )
    }
    if (extractors.length > 0 && !activeEnvId) {
      parts.push('select an active environment to save values there')
    }

    return {
      success: true,
      message: parts.length > 0 ? `Added ${parts.join(' and ')}.` : 'Variables saved.'
    }
  },

  runCollection: async () => {
    const { parsedSpec, activeSpecId, activeProjectId, activeEnvId } = get()
    if (!parsedSpec || !activeSpecId || !activeProjectId || !activeEnvId) return
    if (!isManualCollection(parsedSpec)) return

    set({
      collectionRunStatus: 'running',
      collectionRunLogs: [{ status: 'info', message: 'Starting collection run…' }]
    })
    get().resetCollectionVariables()

    try {
      const preparedEnvironment = await window.api.prepareEnvironmentForRequests(activeEnvId)
      await get().loadEnvironments()
      if (!preparedEnvironment) {
        set({
          collectionRunStatus: 'idle',
          collectionRunLogs: [
            { status: 'error', message: 'Active environment could not be prepared.' }
          ]
        })
        return
      }

      let environment: Environment = {
        id: activeEnvId,
        projectId: activeProjectId,
        name: preparedEnvironment.name,
        variables: preparedEnvironment.variables,
        type: preparedEnvironment.type,
        baseUrl: preparedEnvironment.baseUrl,
        defaultHeaders: preparedEnvironment.defaultHeaders,
        authConfig: preparedEnvironment.authConfig,
        isActive: true
      }

      const collectionVariables = extractCollectionVariables(parsedSpec)
      const specBaseUrl = getExplicitCollectionServerUrl(parsedSpec)
      const requests = extractManualRequests(parsedSpec)
      let chainVariables: Record<string, string> = {}
      const logs: CollectionRunLogEntry[] = []

      for (const manualRequest of requests) {
        const variableMap = buildCollectionVariableMap(
          environment,
          collectionVariables,
          chainVariables,
          specBaseUrl
        )
        set({
          collectionRuntimeVariables: variableMap,
          collectionChainVariables: { ...chainVariables }
        })

        const endpoint = manualRequestToEndpoint(
          activeProjectId,
          `${activeProjectId}-${manualRequest.method}-${manualRequest.path}`.replace(
            /[^a-zA-Z0-9-_]/g,
            '_'
          ),
          manualRequest
        )
        const builtRequest = buildRequest(environment, endpoint, {
          specParameters: getSpecParametersForEndpoint(
            parsedSpec,
            manualRequest.path,
            manualRequest.method
          ),
          specBaseUrl,
          variableMap
        })

        logs.push({
          status: 'info',
          message: `${manualRequest.method} ${manualRequest.path}`
        })
        set({ collectionRunLogs: [...logs] })

        const responseResult = await window.api.sendRequest({
          url: builtRequest.url,
          method: builtRequest.method,
          headers: builtRequest.headers,
          data: builtRequest.body
        })

        set({
          request: {
            url: manualRequest.path,
            method: builtRequest.method,
            headers: endpoint.headers,
            queryParams: endpoint.queryParams,
            body: endpoint.body ?? '',
            auth: endpoint.authConfig
          },
          response: {
            status: responseResult.status,
            statusText: responseResult.statusText,
            headers: responseResult.headers,
            data: responseResult.data,
            loading: false,
            error: responseResult.errorPayload?.message || responseResult.error || null,
            errorPayload: responseResult.errorPayload ?? null
          }
        })

        if (responseResult.status <= 0) {
          logs.push({
            status: 'error',
            message: `${manualRequest.method} ${manualRequest.path} failed: ${responseResult.error || 'Network error'}`
          })
          set({ collectionRunLogs: [...logs], collectionRunStatus: 'idle' })
          return
        }

        if (manualRequest.extractors && manualRequest.extractors.length > 0) {
          await get().refreshVariablesAfterExecution(manualRequest, {
            status: responseResult.status,
            headers: responseResult.headers,
            data: responseResult.data
          })
          chainVariables = get().collectionChainVariables
          const refreshedEnvironment = get().environments.find((env) => env.id === activeEnvId)
          if (refreshedEnvironment) {
            environment = refreshedEnvironment
          }
        }

        logs.push({
          status: 'success',
          message: `${manualRequest.method} ${manualRequest.path} → ${responseResult.status}`
        })
        set({ collectionRunLogs: [...logs] })
      }

      logs.push({ status: 'success', message: 'Collection run completed.' })
      set({ collectionRunLogs: [...logs], collectionRunStatus: 'idle' })
    } catch (error) {
      const appError = normalizeHttpError(error)
      set({
        collectionRunStatus: 'idle',
        collectionRunLogs: [{ status: 'error', message: appError.message }]
      })
    }
  },

  sendRequest: async () => {
    const { request, activeProjectId, activeEnvId, parsedSpec } = get()
    if (!activeProjectId) return

    set({
      response: {
        status: 0,
        statusText: '',
        headers: {},
        data: null,
        loading: true,
        error: null,
        errorPayload: null
      },
      validation: null
    })

    try {
      // Resolve environments
      let variables: Record<string, string> = {}
      let baseUrl = ''
      let defaultHeaders: Array<{ key: string; value: string; enabled: boolean }> = []
      let envAuth: any = null

      if (activeEnvId) {
        const activeEnv = await window.api.prepareEnvironmentForRequests(activeEnvId)
        await get().loadEnvironments()

        if (activeEnv) {
          baseUrl = activeEnv.baseUrl || ''
          defaultHeaders = activeEnv.defaultHeaders || []
          envAuth = activeEnv.authConfig || null
          const environmentForVariables: Environment = {
            id: activeEnvId,
            projectId: activeProjectId,
            name: activeEnv.name,
            variables: activeEnv.variables || {},
            type: activeEnv.type,
            baseUrl,
            defaultHeaders,
            authConfig: envAuth ?? { type: 'none' },
            isActive: true
          }
          variables = buildCollectionVariableMap(
            environmentForVariables,
            parsedSpec && isManualCollection(parsedSpec)
              ? extractCollectionVariables(parsedSpec)
              : [],
            parsedSpec && isManualCollection(parsedSpec) ? get().collectionChainVariables : {},
            parsedSpec && isManualCollection(parsedSpec)
              ? getExplicitCollectionServerUrl(parsedSpec)
              : undefined
          )
        }
      }

      // Interpolate request params — use path only for manual collections; base URL comes from environment
      const resolved = resolveEditorRequest(request, {
        variables,
        baseUrl,
        defaultHeaders,
        envAuth,
        isManualCollection: Boolean(parsedSpec && isManualCollection(parsedSpec)),
        specBaseUrl:
          parsedSpec && isManualCollection(parsedSpec)
            ? getExplicitCollectionServerUrl(parsedSpec)
            : undefined
      })

      const resolvedUrl = resolved.url
      const headers = resolved.headers
      let resolvedBody: unknown = null
      if (resolved.body) {
        try {
          resolvedBody = JSON.parse(resolved.body)
        } catch {
          resolvedBody = resolved.body
        }
      }

      // Send HTTP Request
      const responseResult = await window.api.sendRequest({
        url: resolvedUrl,
        method: resolved.method,
        headers,
        data: resolvedBody
      })

      let validationState: ValidationState | null = null

      if (responseResult.status > 0 && parsedSpec) {
        const validationUrl = isManualCollection(parsedSpec)
          ? findManualOpenApiPathForValidation(parsedSpec, request.method, resolvedUrl)
          : resolvedUrl
        validationState = await window.api.validateResponse(
          JSON.stringify(parsedSpec),
          validationUrl,
          request.method,
          responseResult.status,
          responseResult.data
        )
      }

      // Add to SQLite history (Validation Run + Result)
      const runId = generateUUID()
      const batchId = generateUUID()
      const run: ValidationRun = {
        id: runId,
        projectId: activeProjectId,
        url: request.url.trim(),
        method: request.method,
        headers: JSON.stringify(request.headers),
        body: request.body || null,
        batchId
      }

      await window.api.addValidationRun(run)

      const resultId = generateUUID()
      const result: ValidationResult = {
        id: resultId,
        runId: runId,
        responseStatus: responseResult.status,
        responseHeaders: JSON.stringify(responseResult.headers),
        responseBody: responseResult.data ? JSON.stringify(responseResult.data) : null,
        validationErrors: validationState ? JSON.stringify(validationState) : null
      }

      await window.api.addValidationResult(result)

      // Reload history list
      const runs = await window.api.getValidationRuns(activeProjectId)

      if (
        responseResult.status > 0 &&
        parsedSpec &&
        isManualCollection(parsedSpec) &&
        activeEnvId
      ) {
        const manualRequest = findManualRequestForActiveRequest(
          parsedSpec,
          request,
          get().activeManualRequestKey
        )
        if (manualRequest?.extractors && manualRequest.extractors.length > 0) {
          await get().refreshVariablesAfterExecution(manualRequest, {
            status: responseResult.status,
            headers: responseResult.headers,
            data: responseResult.data
          })
        }
      }

      set({
        response: {
          status: responseResult.status,
          statusText: responseResult.statusText,
          headers: responseResult.headers,
          data: responseResult.data,
          loading: false,
          error: responseResult.errorPayload?.message || responseResult.error || null,
          errorPayload: responseResult.errorPayload ?? null
        },
        validation: validationState,
        history: runs,
        ...(parsedSpec && isManualCollection(parsedSpec)
          ? {
              collectionChainVariables: get().collectionChainVariables,
              collectionRuntimeVariables: get().collectionRuntimeVariables
            }
          : {})
      })
    } catch (error) {
      const appError = normalizeHttpError(error)
      set({
        response: {
          status: 0,
          statusText: '',
          headers: {},
          data: null,
          loading: false,
          error: appError.message,
          errorPayload: appError.toPayload()
        }
      })
    }
  },

  clearHistory: async () => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    await window.api.clearValidationRuns(activeProjectId)
    set({ history: [] })
  },

  deleteValidationSession: async (runIds) => {
    if (runIds.length === 0) return
    await window.api.deleteValidationRuns(runIds)
    await get().reloadHistory()
  },

  reloadHistory: async () => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    const runs = await window.api.getValidationRuns(activeProjectId)
    set({ history: runs })
  },

  loadSchedules: async () => {
    const { currentUser } = get()
    if (!currentUser) {
      set({ schedules: [] })
      return
    }
    const schedules = await window.api.getSchedules(currentUser.id)
    set({ schedules })
  },

  saveSchedule: async (input) => {
    const { currentUser } = get()
    if (!currentUser) {
      reportError(new Error('Create your profile in Settings before adding schedules.'))
      return
    }
    await window.api.saveSchedule({ ...input, userId: currentUser.id })
    await get().loadSchedules()
  },

  deleteSchedule: async (id) => {
    await window.api.deleteSchedule(id)
    await get().loadSchedules()
  },

  exportConfiguration: async (input) => {
    try {
      return await window.api.exportConfiguration(input)
    } catch (error) {
      reportError(error)
      throw error
    }
  }
}))
