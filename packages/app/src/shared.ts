import path from 'path'

import type { Server } from './server'

export const ROOTDIR = path.dirname(__dirname)

export const g = new (class {
  server!: Server
})()
