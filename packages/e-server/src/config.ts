import fs from 'fs'
import path from 'path'

// @ts-ignore
import ON_DEATH from 'death'
import rimraf from 'rimraf'

import { DbSqlite } from './db/sqlite'

export const PORT = parseInt(process.env.PORT || '12345')

export const userData = process.env.USER_DATA_PATH || path.join(__dirname, '../data')

export const tmpPath = path.join(userData, 'tmp')
fs.mkdirSync(tmpPath, { recursive: true })

export const db = new DbSqlite(path.join(userData, 'user.db'))

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
