import path from 'path'

import fs from 'fs-extra'

const NEU_DIR = 'neutralino'

fs.copyFileSync(path.join(NEU_DIR, 'backup-app/settings.json'), path.join(NEU_DIR, 'app/settings.json'))
fs.copyFileSync(path.join(NEU_DIR, 'backup-app/assets/neutralino.js'), path.join(NEU_DIR, 'app/assets/neutralino.js'))
