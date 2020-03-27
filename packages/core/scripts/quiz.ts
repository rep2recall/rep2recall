import fs from 'fs'

import glob from 'fast-glob'
import readline from 'readline-sync'
import dayjs from 'dayjs'

import { Matter } from '../src/matter'
import { initDatabase, db } from '../src/schema'

const DECK_NAME = ''
const ROOT = '/Users/patarapolw/GitHubProjects/zhlab/user'

async function main () {
  const files = await glob('**/*.md', {
    cwd: `${ROOT}/quiz/${DECK_NAME}`,
  })

  await initDatabase(`${ROOT}/user.db`)

  while (files.length > 0) {
    const f = files.splice(Math.floor(Math.random() * files.length), 1)[0]
    const id = f.replace(/^.+\//, '').replace(/\.[^.]+$/, '')
    const item = await db.get(id)
    if (item && item.nextReview > dayjs().add(10, 'minute').toDate()) {
      continue
    }

    const md = fs.readFileSync(`${ROOT}/quiz/${DECK_NAME}/${f}`, 'utf8')
    const matter = new Matter()
    const { content } = matter.parse(md)
    const [q, a] = content.split('\n===\n')

    console.log(q)
    readline.question('Press any key to show the answer.')
    console.log(a)

    const res = readline.question('Did you get it right? [y/n][press else to skip] ')

    if (res === 'y') {
      await db.markRight(id, md)
    } else if (res === 'n') {
      await db.markWrong(id, md)
    } else {
      await db.markRepeat(id, md)
    }
  }

  await db.close()
}

main().catch(console.error)
