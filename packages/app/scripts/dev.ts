import path from 'path'

import open from 'open'

import './restore'

const NEU_DIR = 'neutralino'

if (process.platform === 'darwin') {
  open(path.join(NEU_DIR, 'neutralino-mac'))
} else if (process.platform === 'win32') {
  open(path.join(NEU_DIR, 'neutralino-win.exe'))
} else {
  open(path.join(NEU_DIR, 'neutralino-linux'))
}
