import fs from 'fs'
import path from 'path'
import { URL } from 'url'

import { protocol } from 'electron'

import { WEB_PATH, MEDIA_PATH } from '../utils'

protocol.registerStreamProtocol('r2r', (req, callback) => {
  (async () => {
    const u = new URL(req.url)

    const stream = (() => {
      const m = /^\/media\/(.+)$/.exec(u.pathname)
      if (m) {
        const mediaPath = path.join(MEDIA_PATH, m[1])
        if (fs.existsSync(mediaPath)) {
          return fs.createReadStream(mediaPath)
        }
      }
    })()

    if (stream) {
      return stream
    }

    const filePath = path.join(WEB_PATH, u.pathname.substr(1))
    if (fs.existsSync(filePath)) {
      return fs.createReadStream(filePath)
    }
  })().then(callback).catch((e) => ({ error: e }))
})
