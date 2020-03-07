import https from 'https'
import path from 'path'

import unzipper from 'unzipper'
import fs from 'fs-extra'

const VERSION = 'v1.3.0'
const NEU_DIR = 'neutralino'
const downloadUrl = `https://github.com/neutralinojs/neutralinojs/releases/download/${VERSION}/neutralinojs-${VERSION}.zip`

const u = unzipper.Extract({ path: NEU_DIR })
u.once('close', () => {
  fs.ensureDirSync(path.join(NEU_DIR, 'backup-app', 'assets'))
  fs.copyFileSync(path.join(NEU_DIR, 'app/settings.json'), path.join(NEU_DIR, 'backup-app/settings.json'))
  fs.copyFileSync(path.join(NEU_DIR, 'app/assets/neutralino.js'), path.join(NEU_DIR, 'backup-app/assets/neutralino.js'))
  fs.chmodSync(path.join(NEU_DIR, 'neutralino-linux'), 0o755)
  fs.chmodSync(path.join(NEU_DIR, 'neutralino-mac'), 0o755)
})

const download = (url = downloadUrl) => {
  https.get(url, (res) => {
    if (res.statusCode && [301, 302].includes(res.statusCode) && res.headers.location) {
      download(res.headers.location)
    } else {
      res.pipe(u)
    }
  })
}

download()
