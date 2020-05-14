import fs from 'fs'
import path from 'path'

// @ts-ignore
import ON_DEATH from 'death'
import rimraf from 'rimraf'

import { Db } from './db/pouch'

export const PORT = parseInt(process.env.PORT || '12345')

export const userData = process.env.USER_DATA_PATH || path.join(__dirname, '../storage')

export const tmpPath = path.join(userData, 'tmp')
fs.mkdirSync(tmpPath, { recursive: true })

export const db = new Db(path.join(userData, 'pouch'))

export const g: {
  userId?: string
} = {}

ON_DEATH(() => {
  rimraf(tmpPath, (err) => {
    if (err) {
      console.error(err)
    }

    process.exit()
  })
})
