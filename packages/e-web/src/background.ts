import path from 'path'
import { fork } from 'child_process'
import { URL } from 'url'
import fs from 'fs'

import { app, protocol, BrowserWindow, session, shell } from 'electron'
import {
  installVueDevtools
} from 'vue-cli-plugin-electron-builder/lib'
import contextMenu from 'electron-context-menu'
// @ts-ignore
import ON_DEATH from 'death'

const isDevelopment = process.env.NODE_ENV !== 'production'
app.allowRendererProcessReuse = true

contextMenu()

process.env.PORT = process.env.PORT || '12345'
process.env.USER_DATA_PATH = process.env.USER_DATA_PATH || app.getPath('userData')

let isServerStarted = false
if (!isDevelopment) {
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
} else {
  isServerStarted = true
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win: BrowserWindow | null

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
    console.log(evt)
    // @ts-ignore
    if (url !== evt.sender.getURL()) {
      evt.preventDefault()
      shell.openExternal(url)
    }
  })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string)
    // if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const { pathname } = new URL(details.url)

      if (pathname.startsWith('/media')) {
        return callback({
          redirectURL: new URL(pathname, `http://localhost:${process.env.PORT}`).href
        })
      }

      callback({})
    })

    createProtocol('app')
    win.loadURL('app://./index.html')
  }

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
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    // Devtools extensions are broken in Electron 6.0.0 and greater
    // See https://github.com/nklayman/vue-cli-plugin-electron-builder/issues/378 for more info
    // Electron will not launch with Devtools extensions installed on Windows 10 with dark mode
    // If you are not using Windows 10 dark mode, you may uncomment these lines
    // In addition, if the linked issue is closed, you can upgrade electron and uncomment these lines
    try {
      await installVueDevtools()
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  if (isServerStarted) {
    createWindow()
  }
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

function createProtocol (scheme: string) {
  protocol.registerBufferProtocol(
    scheme,
    (request, respond) => {
      let pathName = new URL(request.url).pathname
      pathName = decodeURI(pathName) // Needed in case URL contains spaces

      fs.readFile(path.join(__dirname, pathName), (error, data) => {
        if (error) {
          console.error(`Failed to read ${pathName} on ${scheme} protocol`, error)
        }
        const extension = path.extname(pathName).toLowerCase()
        let mimeType = ''

        if (extension === '.js') {
          mimeType = 'text/javascript'
        } else if (extension === '.html') {
          mimeType = 'text/html'
        } else if (extension === '.css') {
          mimeType = 'text/css'
        } else if (extension === '.svg' || extension === '.svgz') {
          mimeType = 'image/svg+xml'
        } else if (extension === '.json') {
          mimeType = 'application/json'
        }

        respond({ mimeType, data })
      })
    }
  )
}
