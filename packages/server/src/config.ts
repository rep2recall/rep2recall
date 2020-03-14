import path from 'path'

import fs from 'fs-extra'
import { AppDirs } from 'appdirs'
import rimraf from 'rimraf'

export let config = {
  port: 24000,
  grayMatter: {
    excerptSeparator: '<!-- excerpt_separator -->',
  },
}

export const appPath = new AppDirs('rep2recall').userDataDir()
export const mediaPath = path.join(appPath, 'media')
export const tmpPath = path.join(appPath, 'tmp')

fs.mkdirpSync(mediaPath)
fs.mkdirpSync(tmpPath)
ensureConfig()

function ensureConfig () {
  const configPath = path.join(appPath, 'config.json')

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }
}

function onExit () {
  rimraf.sync(tmpPath)
  process.exit()
}

process.on('exit', onExit)
process.on('SIGINT', onExit)
process.on('uncaughtException', onExit)
