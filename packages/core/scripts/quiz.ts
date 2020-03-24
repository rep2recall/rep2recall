import glob from 'fast-glob'

import { initDatabase } from '../src/schema'

const DECK_NAME = ''

async function main () {
  const files = await glob('**/*.md', {
    cwd: '../../user',
  })

  console.log(files)
}

main().catch(console.error)
