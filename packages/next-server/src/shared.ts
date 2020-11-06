import path from 'path'

import { LocalDb } from './db/local'

export const db = new LocalDb(
  process.env.DB || path.join(__dirname, '../assets/db.sqlite')
)
