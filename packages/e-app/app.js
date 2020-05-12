const path = require('path')
const { fork } = require('child_process')
const { URL } = require('url')
const fs = require('fs')

const { app, protocol, BrowserWindow, session, shell } = require('electron')
const contextMenu = require('electron-context-menu')
const ON_DEATH = require('death')

const isDevelopment = process.env.NODE_ENV !== 'production'
app.allowRendererProcessReuse = true

contextMenu()

process.env.PORT = process.env.PORT || '12345'
process.env.USER_DATA_PATH = process.env.USER_DATA_PATH || app.getPath('userData')

let isServerStarted = false
const p = fork(path.join(__dirname, './server/index.js'), [], {
  stdio: 'inherit'
})
p.on('message', (msg) => {
  if (msg === 'started') {
    isServerStarted = true

    if (!win) {
      createWindow()
    }
  }
})

ON_DEATH(() => {
  if (!p.killed) {
    p.kill()
  }
})

app.once('before-quit', () => {
  if (!p.killed) {
    p.kill()
  }
})

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }])

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true
    }
  })
  win.maximize()

  win.webContents.on('will-navigate', (evt, url) => {
    // @ts-ignore
    if (url !== evt.sender.getURL()) {
      evt.preventDefault()
      shell.openExternal(url)
    }
  })

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const { pathname } = new URL(details.url)

    if (pathname.startsWith('/media')) {
      return callback({
        redirectURL: new URL(pathname, `http://localhost:${process.env.PORT}`).href
      })
    }

    callback({})
  })

  win.loadURL(`http://localhost:${process.env.PORT}`)

  win.on('closed', () => {
    win = null
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isServerStarted) {
    createWindow()
  }
})
