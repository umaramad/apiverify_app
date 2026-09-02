export { noneStrategy } from './noneStrategy'
export { basicStrategy } from './basicStrategy'
export { bearerStrategy } from './bearerStrategy'
export { apiKeyStrategy } from './apiKeyStrategy'
export { customHeadersStrategy } from './customHeadersStrategy'
export { oauth2Strategy } from './oauth2Strategy'
export { awsSignatureV4Strategy } from './awsSignatureV4Strategy'

import type { AuthStrategy } from '../types'
import { noneStrategy } from './noneStrategy'
import { basicStrategy } from './basicStrategy'
import { bearerStrategy } from './bearerStrategy'
import { apiKeyStrategy } from './apiKeyStrategy'
import { customHeadersStrategy } from './customHeadersStrategy'
import { oauth2Strategy } from './oauth2Strategy'
import { awsSignatureV4Strategy } from './awsSignatureV4Strategy'

export const builtInAuthStrategies: AuthStrategy[] = [
  noneStrategy,
  basicStrategy,
  bearerStrategy,
  apiKeyStrategy,
  customHeadersStrategy,
  oauth2Strategy,
  awsSignatureV4Strategy,
]
