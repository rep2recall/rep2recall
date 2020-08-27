import https from 'https'
import path from 'path'
import fs from 'fs'

import unzipper from 'unzipper'

const VERSION = 'v1.5.0'
const NEU_DIR = 'release'
const downloadUrl = `https://github.com/neutralinojs/neutralinojs/releases/download/${VERSION}/neutralinojs-${VERSION}.zip`

const u = unzipper.Extract({ path: NEU_DIR })
u.once('close', () => {
  fs.chmodSync(path.join(NEU_DIR, 'neutralino-linux'), 0o755)
  fs.chmodSync(path.join(NEU_DIR, 'neutralino-mac'), 0o755)
})

const download = (url = downloadUrl) => {
  https.get(url, (res) => {
    if (
      res.statusCode &&
      [301, 302].includes(res.statusCode) &&
      res.headers.location
    ) {
      download(res.headers.location)
    } else {
      res.pipe(u)
    }
  })
}

download()
