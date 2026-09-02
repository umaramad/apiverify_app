import { ipcMain, BrowserWindow } from 'electron'
import { appErrorFromCode } from '../../shared/errors'
import { runMigrations } from '../db/migrations/runner'
import { ProjectRepository } from '../db/repositories/ProjectRepository'
import { UserRepository } from '../db/repositories/UserRepository'
import { EnvironmentRepository } from '../db/repositories/EnvironmentRepository'
import { ApiSpecRepository } from '../db/repositories/ApiSpecRepository'
import { ValidationRunRepository } from '../db/repositories/ValidationRunRepository'
import { ValidationResultRepository } from '../db/repositories/ValidationResultRepository'
import { ValidationScheduleRepository } from '../db/repositories/ValidationScheduleRepository'
import { parseSpecContent } from '../services/parser.service'
import { sendHttpRequest } from '../services/http.service'
import { validateResponse } from '../services/validator.service'
import { validationRunnerService } from '../services/validationRunner.service'
import { schedulerService } from '../services/scheduler.service'
import { saveConfigurationExport } from '../services/export.service'
import { pickSpecFile } from '../services/specImport.service'
import { verifyClientCredentialsToken } from '../services/oauthToken.service'
import { resolveEnvironmentForRequests } from '../services/environmentAuth.service'
import { getProxySettings, saveProxySettings } from '../services/proxySettings.service'
import { clearProxyAgentsCache } from '../services/httpTransport'
import { registerLinuxSearchAssistantHandlers } from '../../modules/linuxSearchAssistant/main'
import { registerSafeHandler, registerSafeHandlerWithEvent } from './safeHandler'
import {
  assertOptionalUuid,
  assertUuid,
  validateApiSpecInput,
  validateEnvironmentInput,
  validateExportConfigurationInput,
  validateHttpRequestInput,
  validateParseSpecContent,
  validateProjectInput,
  validateProjectUpdate,
  validateScheduleInput,
  validateUserInput,
  validateUserUpdate,
  validateValidationResultInput,
  validateValidationRunInput,
  validateValidationRunStartInput,
  validateDeleteValidationRunsInput,
  validateValidateResponseArgs,
  validateVerifyOAuthTokenInput,
  validateProxySettingsInput,
} from './validators'

const projectRepo = new ProjectRepository()
const userRepo = new UserRepository()
const envRepo = new EnvironmentRepository()
const specRepo = new ApiSpecRepository()
const runRepo = new ValidationRunRepository()
const resultRepo = new ValidationResultRepository()
const scheduleRepo = new ValidationScheduleRepository()

export function registerIpcHandlers(): void {
  runMigrations()

  registerSafeHandler(ipcMain, 'db:createProject', (project) =>
    projectRepo.create(validateProjectInput(project))
  )
  registerSafeHandler(ipcMain, 'db:updateProject', (id, name) => {
    const validated = validateProjectUpdate(id, name)
    return projectRepo.update(validated.id, validated.name)
  })
  registerSafeHandler(ipcMain, 'db:getProjects', (userId) => {
    const validatedUserId = assertOptionalUuid(userId, 'user id')
    return validatedUserId ? projectRepo.findByUserId(validatedUserId) : projectRepo.findAll()
  })
  registerSafeHandler(ipcMain, 'db:deleteProject', (id) => projectRepo.delete(assertUuid(id, 'project id')))

  registerSafeHandler(ipcMain, 'db:createUser', (user) => userRepo.create(validateUserInput(user)))
  registerSafeHandler(ipcMain, 'db:updateUser', (id, name, email) => {
    const validated = validateUserUpdate(id, name, email)
    return userRepo.update(validated.id, validated.name, validated.email)
  })
  registerSafeHandler(ipcMain, 'db:getCurrentUser', () => userRepo.findFirst())
  registerSafeHandler(ipcMain, 'db:assignProjectsToUser', (userId) => {
    const validatedUserId = assertUuid(userId, 'user id')
    projectRepo.assignOrphansToUser(validatedUserId)
    return projectRepo.findByUserId(validatedUserId)
  })

  registerSafeHandler(ipcMain, 'db:saveSpec', (spec) => specRepo.create(validateApiSpecInput(spec)))
  registerSafeHandler(ipcMain, 'db:getSpecsForProject', (projectId) =>
    specRepo.findByProjectId(assertUuid(projectId, 'project id'))
  )
  registerSafeHandler(ipcMain, 'db:deleteSpec', (id) => specRepo.delete(assertUuid(id, 'spec id')))

  registerSafeHandler(ipcMain, 'db:saveEnvironment', (env) =>
    envRepo.create(validateEnvironmentInput(env))
  )
  registerSafeHandler(ipcMain, 'db:getEnvironmentsForProject', (projectId) =>
    envRepo.findByProjectId(assertUuid(projectId, 'project id'))
  )
  registerSafeHandler(ipcMain, 'db:deleteEnvironment', (id) =>
    envRepo.delete(assertUuid(id, 'environment id'))
  )
  registerSafeHandler(ipcMain, 'db:setActiveEnvironment', (projectId, activeId) =>
    envRepo.setActive(
      assertUuid(projectId, 'project id'),
      assertOptionalUuid(activeId, 'environment id')
    )
  )

  registerSafeHandler(ipcMain, 'db:addValidationRun', (run) =>
    runRepo.create(validateValidationRunInput(run))
  )
  registerSafeHandler(ipcMain, 'db:getValidationRuns', (projectId) =>
    runRepo.findByProjectId(assertUuid(projectId, 'project id'))
  )
  registerSafeHandler(ipcMain, 'db:clearValidationRuns', (projectId) =>
    runRepo.deleteByProjectId(assertUuid(projectId, 'project id'))
  )
  registerSafeHandler(ipcMain, 'db:deleteValidationRuns', (runIds) =>
    runRepo.deleteByIds(validateDeleteValidationRunsInput(runIds))
  )
  registerSafeHandler(ipcMain, 'db:addValidationResult', (result) =>
    resultRepo.create(validateValidationResultInput(result))
  )
  registerSafeHandler(ipcMain, 'db:getValidationResult', (runId) =>
    resultRepo.findByRunId(assertUuid(runId, 'run id'))
  )

  registerSafeHandler(ipcMain, 'api:parseSpecContent', (content) =>
    parseSpecContent(validateParseSpecContent(content))
  )

  registerSafeHandlerWithEvent(ipcMain, 'api:pickSpecFile', (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined
    return pickSpecFile(parentWindow)
  })

  registerSafeHandler(ipcMain, 'api:verifyOAuthToken', (input) =>
    verifyClientCredentialsToken(validateVerifyOAuthTokenInput(input))
  )

  registerSafeHandler(ipcMain, 'api:prepareEnvironmentForRequests', (environmentId) =>
    resolveEnvironmentForRequests({ id: assertUuid(environmentId, 'environment id') })
  )

  registerSafeHandler(ipcMain, 'api:sendRequest', (reqData) =>
    sendHttpRequest(validateHttpRequestInput(reqData))
  )

  registerSafeHandler(ipcMain, 'settings:getProxy', () => getProxySettings())
  registerSafeHandler(ipcMain, 'settings:saveProxy', (settings) => {
    const saved = saveProxySettings(validateProxySettingsInput(settings))
    clearProxyAgentsCache()
    return saved
  })

  registerSafeHandler(ipcMain, 'api:validateResponse', (specContent, path, method, status, responseData) => {
    const validated = validateValidateResponseArgs(specContent, path, method, status, responseData)
    return validateResponse(
      validated.specContent,
      validated.path,
      validated.method,
      validated.status,
      validated.responseData
    )
  })

  registerSafeHandler(ipcMain, 'validation:start', (input) =>
    validationRunnerService.run(validateValidationRunStartInput(input))
  )

  registerSafeHandler(ipcMain, 'validation:cancel', () => {
    validationRunnerService.cancel()
    return { success: true }
  })

  registerSafeHandler(ipcMain, 'db:getSchedules', (userId) =>
    scheduleRepo.findByUserId(assertUuid(userId, 'user id'))
  )
  registerSafeHandler(ipcMain, 'db:saveSchedule', (schedule) =>
    scheduleRepo.save(validateScheduleInput(schedule))
  )
  registerSafeHandler(ipcMain, 'db:deleteSchedule', (id) =>
    scheduleRepo.delete(assertUuid(id, 'schedule id'))
  )
  registerSafeHandler(ipcMain, 'scheduler:runNow', (id) => {
    const schedule = scheduleRepo.findById(assertUuid(id, 'schedule id'))
    if (!schedule) {
      throw appErrorFromCode('VALIDATION', 'Schedule not found.', { retryable: false })
    }
    if (schedule.status === 'running') {
      throw appErrorFromCode('VALIDATION', 'This schedule is already running.', { retryable: false })
    }
    void schedulerService.executeSchedule({ ...schedule, status: 'pending' })
    return { success: true }
  })

  registerSafeHandler(ipcMain, 'export:configuration', (input) =>
    saveConfigurationExport(validateExportConfigurationInput(input))
  )

  registerLinuxSearchAssistantHandlers(ipcMain)
}
