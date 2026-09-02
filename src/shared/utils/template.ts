/**
 * Replaces all occurrences of {{key}} in the template string with the corresponding
 * value from the envVariables record.
 * 
 * If a variable is not found in the record, it is left untouched (e.g. {{missing}}).
 * 
 * @param template The string containing variables to interpolate.
 * @param envVariables The dictionary of environment variables.
 * @returns The interpolated string.
 */
export function interpolateVariables(template: string, envVariables: Record<string, string>): string {
  if (!template) return ''
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmedKey = key.trim()
    return envVariables[trimmedKey] !== undefined ? envVariables[trimmedKey] : `{{${trimmedKey}}}`
  })
}
