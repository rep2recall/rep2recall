const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const pkg = require('../../e-app/package.json')
const { dependencies } = require('../package.json')

pkg.dependencies = Object.assign(dependencies, pkg.peerDependencies)

fs.writeFileSync(path.join(__dirname, '../../e-app/package.json'), JSON.stringify(pkg, null, 2))

spawnSync('npm', ['i'], {
  cwd: path.join(__dirname, '../../e-app'),
  stdio: 'inherit'
})
