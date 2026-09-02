/**
 * Open / read local log files for the Local Log Viewer.
 * No SSH — dialog + fs only. Read logic lives in services/localLogReader
 * (pure fs, no Electron), keeping this file to Electron surface only.
 */
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import type { LocalLogReadOptions } from '../models/localLogViewer'
import {
  MAX_LOCAL_LOG_OPEN_FILES,
  type LocalLogFileContent,
  type OpenLocalLogFilesResult,
} from '../models/localLogViewer'
import { readLocalLogWindow } from '../services/localLogReader'

const LOG_FILTERS: OpenDialogOptions['filters'] = [
  {
    name: 'Log / text files',
    extensions: ['log', 'txt', 'out', 'err', 'json', 'csv', 'md', 'conf', 'cfg', 'ini', 'yml', 'yaml'],
  },
  { name: 'All files', extensions: ['*'] },
]

export async function openLocalLogFiles(
  existingCount = 0,
  opts?: LocalLogReadOptions
): Promise<OpenLocalLogFilesResult> {
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const remaining = Math.max(0, MAX_LOCAL_LOG_OPEN_FILES - existingCount)
  if (remaining <= 0) {
    return {
      canceled: false,
      files: [],
      skipped: [
        {
          filePath: '',
          reason: `At most ${MAX_LOCAL_LOG_OPEN_FILES} files can be open at once.`,
        },
      ],
    }
  }

  const dialogOptions: OpenDialogOptions = {
    title: 'Open log files',
    properties: ['openFile', 'multiSelections'],
    filters: LOG_FILTERS,
  }

  const { canceled, filePaths } = parent
    ? await dialog.showOpenDialog(parent, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions)

  if (canceled || filePaths.length === 0) {
    return { canceled: true }
  }

  const files: LocalLogFileContent[] = []
  const skipped: Array<{ filePath: string; reason: string }> = []

  for (const filePath of filePaths) {
    if (files.length >= remaining) {
      skipped.push({
        filePath,
        reason: `Open-file limit (${MAX_LOCAL_LOG_OPEN_FILES}) reached.`,
      })
      continue
    }
    try {
      files.push(readLocalLogWindow(filePath, opts))
    } catch (err) {
      skipped.push({
        filePath,
        reason: err instanceof Error ? err.message : 'Could not read file.',
      })
    }
  }

  return { canceled: false, files, skipped }
}

export function reloadLocalLogFile(
  filePath: string,
  opts?: LocalLogReadOptions
): LocalLogFileContent {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('filePath is required')
  }
  return readLocalLogWindow(filePath.trim(), opts)
}
