#!/usr/bin/env node

import path from 'path'
import { spawn } from 'child_process'

import meow from 'meow'
import fs from 'fs-extra'
import open from 'open'

import { initialize } from './init'

async function main () {
  const { flags: { init, dir, build, mode, version, cache } } = meow(`
  Usage
    $ neu
  
  Options
    --init          Initialize only
    --dir, -d       Location of web bundle
    --build, -b     Build for production
    --mode          Mode (development / production)
    --version, -v   Neutralino version
    --cache, -c     Where to cache Neutralino binary
`, {
    flags: {
      init: {
        type: 'boolean'
      },
      dir: {
        alias: 'd',
        type: 'string',
        default: 'dist'
      },
      build: {
        alias: 'b',
        type: 'boolean'
      },
      mode: {
        type: 'string'
      },
      version: {
        alias: 'v',
        type: 'string',
        default: 'v1.4.0'
      },
      cache: {
        alias: 'c',
        type: 'string',
        default: 'neutralino'
      }
    }
  })

  if (!fs.existsSync(cache)) {
    await initialize({ version, dir: cache })
  }

  if (init) {
    return
  }

  // try {
  //   const html = fs.readFileSync(path.join(dir, 'app/index.html'), 'utf8')
  //   const runner = '<script src="/neutralino.js"></script>'

  //   if (!html.includes(runner)) {
  //     fs.writeFileSync(path.join(dir, 'app/index.html'), html.replace(
  //       /<\/head>/i,
  //       runner + '\n</head>'
  //     ))
  //   }
  // } catch (_) {}

  try {
    if (mode === 'development') {
      fs.copyFileSync('settings.dev.json', path.join(dir, 'app/settings.json'))
    } else {
      fs.copyFileSync('settings.json', path.join(dir, 'app/settings.json'))
    }
  } catch (_) {
    fs.copyFileSync(path.join(cache, 'app/settings.json'), path.join(dir, 'app/settings.json'))
  }

  fs.mkdirpSync(path.join(dir, 'app/assets'))

  fs.copyFileSync(path.join(cache, 'app/assets/neutralino.js'), path.join(dir, 'app/assets/neutralino.js'))
  fs.ensureFileSync(path.join(dir, 'storage/.gitkeep'))

  const copyMac = () => fs.copyFileSync(path.join(cache, 'neutralino-mac'), path.join(dir, 'neutralino-mac.app'))
  const copyWin = () => fs.copyFileSync(path.join(cache, 'neutralino-win.exe'), path.join(dir, 'neutralino-win.exe'))
  const copyLinux = () => {
    fs.copyFileSync(path.join(cache, 'neutralino-linux'), path.join(dir, 'neutralino-linux'))
    fs.chmodSync(path.join(dir, 'neutralino-linux'), 0o755)
  }

  if (!build) {
    if (process.platform === 'darwin') {
      copyMac()
      open(path.join(dir, 'neutralino-mac.app'))
    } else if (process.platform === 'win32') {
      copyWin()
      open(path.join(dir, 'neutralino-win.exe'))
    } else {
      copyLinux()
      open(path.join(dir, 'neutralino-linux'))
    }
  } else {
    copyMac()
    copyWin()
    copyLinux()

    fs.ensureDirSync('release')
    spawn('zip', ['-r', path.join('release', 'app.zip'), dir], {
      stdio: 'inherit'
    })
  }
}

main()
