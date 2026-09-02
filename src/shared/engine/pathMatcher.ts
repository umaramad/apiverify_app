/**
 * Matches a concrete request path against OpenAPI path templates.
 * e.g. /users/123 matches /users/{id}
 */
export function matchPath(requestPath: string, openApiPaths: string[]): string | null {
  const cleanPath = requestPath.split('?')[0]

  const normalize = (p: string): string => '/' + p.split('/').filter(Boolean).join('/')
  const target = normalize(cleanPath)

  for (const apiPath of openApiPaths) {
    const normApiPath = normalize(apiPath)
    const regexPattern = normApiPath
      .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{[a-zA-Z0-9_]+\\\}/g, '([^/]+)')

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    if (regex.test(target)) {
      return apiPath
    }
  }
  return null
}

export function extractPathParamNames(path: string): string[] {
  const names: string[] = []
  const regex = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(path)) !== null) {
    names.push(match[1])
  }
  return names
}

export function extractPathname(url: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname
    }
  } catch {
    // fall through
  }
  return url.split('?')[0]
}
