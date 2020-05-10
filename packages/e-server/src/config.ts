import fs from 'fs'
import path from 'path'

// @ts-ignore
import ON_DEATH from 'death'
import rimraf from 'rimraf'

import { Db } from './db/local'

export const PORT = parseInt(process.env.PORT || '12345')

export const userData = (() => {
  try {
    const { app } = require('electron')
    return app.getPath('userData')
  } catch (e) {
    if (e) {
      console.error(e)
    }
  }

  return '.'
})()

export const mediaPath = path.join(userData, 'media')
export const tmpPath = path.join(userData, 'tmp')

fs.mkdirSync(mediaPath, { recursive: true })
fs.mkdirSync(tmpPath, { recursive: true })

export const db = new Db(path.join(userData, 'user.db'))

export const g: {
  userId?: number
} = {}

ON_DEATH(() => {
  rimraf(tmpPath, (err) => {
    console.error(err)
  })
})
