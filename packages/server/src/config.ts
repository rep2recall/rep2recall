import path from 'path'

import fs from 'fs-extra'
import { AppDirs } from 'appdirs'

export let config = {
  port: 24000,
  grayMatter: {
    excerptSeparator: '<!-- excerpt_separator -->',
  },
}

export const appPath = new AppDirs('rep2recall').userDataDir()
export const mediaPath = path.join(appPath, 'media')

fs.mkdirpSync(mediaPath)
ensureConfig()

function ensureConfig () {
  const configPath = path.join(appPath, 'config.json')

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }
}
