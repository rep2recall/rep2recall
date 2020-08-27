import path from 'path'

import fs from 'fs-extra'
import rimraf from 'rimraf'

const NEU_DIR = 'release'

const paths = ['settings.json', 'assets/neutralino.js']

paths.map((p) => {
  const dst = path.join(NEU_DIR, path.parse(p).base)
  try {
    fs.unlinkSync(dst)
  } catch (_) {}

  fs.renameSync(path.join(NEU_DIR, 'app', p), dst)
})

rimraf.sync(path.join(NEU_DIR, 'app'))

fs.copySync('dist', path.join(NEU_DIR, 'app'))

paths.map((p) => {
  fs.renameSync(
    path.join(NEU_DIR, path.parse(p).base),
    path.join(NEU_DIR, 'app', p)
  )
})
