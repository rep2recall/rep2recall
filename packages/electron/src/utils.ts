import fs from 'fs'
import path from 'path'

import { app } from 'electron'

export const MEDIA_PATH = path.join(app.getPath('userData'), 'media')
export const WEB_PATH = path.resolve('lib/web')

if (!fs.existsSync(MEDIA_PATH)) {
  fs.mkdirSync(MEDIA_PATH, { recursive: true })
}
