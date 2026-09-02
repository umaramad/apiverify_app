import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc/handlers'
import { getLogger } from '../shared/logger'
import { registerProcessErrorHandlers } from './processErrors'
import { initAutoUpdater } from './updater'
import { schedulerService } from './services/scheduler.service'
import {
  getSessionManager,
  shutdownSessionManager,
} from '../modules/linuxSearchAssistant/main/sessionManager'

const logger = getLogger().child('app')

registerProcessErrorHandlers()

let sshShutdownStarted = false

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // Linux window icon; macOS Dock uses app.dock.setIcon (dev) / .icns (packaged).
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', () => {
    void getSessionManager()
      .closeAll()
      .catch((error) => {
        logger.error('Failed to close SSH sessions on window close', {
          message: error instanceof Error ? error.message : String(error),
        })
      })
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('found-in-page', (_event, result) => {
    mainWindow.webContents.send('window:foundInPage', result)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  logger.info('Application ready')

  electronApp.setAppUserModelId('app.apiverify.desktop')

  if (!is.dev) {
    initAutoUpdater()
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register all IPC handlers
  registerIpcHandlers()
  schedulerService.start()

  ipcMain.handle('window:findInPage', (event, text, options) => {
    const webContents = event.sender
    return webContents.findInPage(text, options)
  })

  ipcMain.handle('window:stopFindInPage', (event, action) => {
    const webContents = event.sender
    webContents.stopFindInPage(action)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (sshShutdownStarted) return
  sshShutdownStarted = true
  event.preventDefault()
  void shutdownSessionManager()
    .catch((error) => {
      logger.error('Failed to shut down SSH sessions cleanly', {
        message: error instanceof Error ? error.message : String(error),
      })
    })
    .finally(() => {
      app.quit()
    })
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
