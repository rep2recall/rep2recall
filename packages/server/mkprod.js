const { devDependencies, ...o } = require('./package.json')
require('fs').writeFileSync('./package.json', JSON.stringify(o))
