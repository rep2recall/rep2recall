import https from 'https'
import path from 'path'

import unzipper from 'unzipper'
import fs from 'fs-extra'

export async function initialize (opts: {
  version?: string
  dir?: string
} = {}) {
  const VERSION = opts.version || 'v1.4.0'
  const NEU_DIR = opts.dir || 'neutralino'

  console.log(`Downloading Neutralino ${VERSION}`)
  const downloadUrl = `https://github.com/neutralinojs/neutralinojs/releases/download/${VERSION}/neutralinojs-${VERSION}.zip`

  const u = unzipper.Extract({ path: NEU_DIR })
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

  return new Promise((resolve, reject) => {
    u
      .once('close', () => {
        fs.chmodSync(path.join(NEU_DIR, 'neutralino-linux'), 0o755)
        fs.chmodSync(path.join(NEU_DIR, 'neutralino-mac'), 0o755)
        resolve()
      })
      .on('error', reject)
  })
}
