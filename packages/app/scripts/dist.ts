import path from 'path'

import fs from 'fs-extra'
import rimraf from 'rimraf'

import './restore'

const OUT_DIR = 'dist/app'
const NEU_DIR = 'neutralino'

rimraf.sync(OUT_DIR)
fs.mkdirSync(OUT_DIR, { recursive: true })

/**
 * Linux runtime
 */
fs.copyFileSync(path.join(NEU_DIR, 'neutralino-linux'), path.join(OUT_DIR, 'neutralino-linux'))
fs.chmodSync(path.join(OUT_DIR, 'neutralino-linux'), 0o755)

/**
 * MacOS runtime
 */
fs.copyFileSync(path.join(NEU_DIR, 'neutralino-mac'), path.join(OUT_DIR, 'neutralino-mac.app'))

/**
 * Windows runtime
 */
fs.copyFileSync(path.join(NEU_DIR, 'neutralino-win.exe'), path.join(OUT_DIR, 'neutralino-win.exe'))

/**
 * Storage
 */
fs.ensureFileSync(path.join(OUT_DIR, 'storage/.gitkeep'))

/**
 * App specific files
 */
fs.copySync(path.join(NEU_DIR, 'app'), path.join(OUT_DIR, 'app'))
fs.copyFileSync('settings.json', path.join(OUT_DIR, 'app/settings.json'))
