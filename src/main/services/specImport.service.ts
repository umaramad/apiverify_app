import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron'
import fs from 'fs'
import path from 'path'
import { appErrorFromCode } from '../../shared/errors/normalize'

export const MAX_SPEC_FILE_BYTES = 5_000_000

const SPEC_EXTENSIONS = new Set(['.json', '.yaml', '.yml'])

export type PickSpecFileResult =
  | { canceled: true }
  | {
      canceled: false
      fileName: string
      content: string
    }

export function readSpecFileFromPath(filePath: string): { fileName: string; content: string } {
  const ext = path.extname(filePath).toLowerCase()
  if (!SPEC_EXTENSIONS.has(ext)) {
    throw appErrorFromCode(
      'VALIDATION',
      'File must be a JSON or YAML OpenAPI/Swagger specification.',
      { retryable: false }
    )
  }

  if (!fs.existsSync(filePath)) {
    throw appErrorFromCode('VALIDATION', 'Specification file not found.', { retryable: false })
  }

  const stats = fs.statSync(filePath)
  if (stats.size > MAX_SPEC_FILE_BYTES) {
    throw appErrorFromCode('VALIDATION', 'Specification file is too large.', { retryable: false })
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  if (!content.trim()) {
    throw appErrorFromCode('VALIDATION', 'Specification file is empty.', { retryable: false })
  }

  return {
    fileName: path.basename(filePath, ext),
    content,
  }
}

export async function pickSpecFile(parentWindow?: BrowserWindow): Promise<PickSpecFileResult> {
  const dialogOptions: OpenDialogOptions = {
    title: 'Import OpenAPI Specification',
    properties: ['openFile'],
    filters: [
      { name: 'OpenAPI / Swagger', extensions: ['json', 'yaml', 'yml'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'YAML', extensions: ['yaml', 'yml'] },
    ],
  }

  const { canceled, filePaths } = parentWindow
    ? await dialog.showOpenDialog(parentWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions)

  if (canceled || filePaths.length === 0) {
    return { canceled: true }
  }

  const { fileName, content } = readSpecFileFromPath(filePaths[0])
  return { canceled: false, fileName, content }
}
