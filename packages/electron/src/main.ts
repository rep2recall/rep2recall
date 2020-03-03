import { app, BrowserWindow, protocol } from 'electron'
import contextMenu from 'electron-context-menu'

try {
  require('electron-reloader')(module)
} catch (_) {}

protocol.registerSchemesAsPrivileged([
  { scheme: 'r2r', privileges: { secure: true, standard: true } },
])

app.allowRendererProcessReuse = true
contextMenu()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  require('./api')
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // if (process.platform !== 'darwin') {
  app.quit()
  // }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

function createWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
    },
  })
  win.maximize()

  // and load the index.html of the app.
  win.loadURL('r2r://./index.html')
}
