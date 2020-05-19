import { FastifyInstance } from 'fastify'
// @ts-ignore
import fileUpload from 'fastify-file-upload'

import { db } from '../config'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.register(fileUpload)

  f.post('/upload', {
    schema: {
      tags: ['media'],
      summary: 'Upload a media',
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'object' },
          key: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            key: { type: 'string' }
          }
        }
      }
    }
  }, async (req) => {
    const { file, key } = req.body

    return {
      key: db.insertMedia(file, key)
    }
  })

  next()
}
