import { prepareEnvironmentAuth } from '../../shared/auth/prepareEnvironmentAuth'
import type { Environment } from '../../shared/models'
import { EnvironmentRepository } from '../db/repositories/EnvironmentRepository'
import { verifyClientCredentialsToken } from './oauthToken.service'

const envRepo = new EnvironmentRepository()

/**
 * Loads the latest environment from the database and refreshes OAuth tokens when needed.
 */
export async function resolveEnvironmentForRequests(
  environment: Pick<Environment, 'id'> & Partial<Environment>
): Promise<Environment> {
  const dbEnvironment = envRepo.findById(environment.id) ?? (environment as Environment)

  const { environment: prepared, authConfigChanged } = await prepareEnvironmentAuth(
    dbEnvironment,
    async ({ tokenUrl, clientId, clientSecret }) => {
      const result = await verifyClientCredentialsToken({ tokenUrl, clientId, clientSecret })
      if (result.success && result.accessToken) {
        return { accessToken: result.accessToken, expiresIn: result.expiresIn }
      }
      return { error: result.error }
    }
  )

  if (authConfigChanged) {
    envRepo.create(prepared)
  }

  return prepared
}
