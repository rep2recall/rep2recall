import path from 'path'

import { FastifyInstance } from 'fastify'
import ws from 'fastify-websocket'
// @ts-ignore
import fileUpload from 'fastify-file-upload'
import { nanoid } from 'nanoid'
import { UploadedFile } from 'express-fileupload'
import { spawn, Worker } from 'threads'
import pino from 'pino'

import { tmpPath } from '../config'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.register(fileUpload)
  f.post('/upload', {
    schema: {
      tags: ['file'],
      summary: 'Upload an archive',
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }
  }, async (req) => {
    const id = nanoid()
    const file = req.body.file as UploadedFile

    await new Promise((resolve, reject) => {
      file.mv(path.join(tmpPath, id), (err) => {
        err ? reject(err) : resolve()
      })
    })

    return { id }
  })

  // eslint-disable-next-line func-call-spacing
  const socketMap = new Map<string, (msg: any) => void>()

  f.register(ws)
  f.get('/:id', {
    websocket: true,
    schema: {
      tags: ['file'],
      summary: 'Process an archive'
    }
  }, (conn, req, params = {}) => {
    const logger = pino({
      prettyPrint: true
    })

    conn.socket.on('message', async (msg: string) => {
      const { id, type, filename } = JSON.parse(msg)

      const isNew = !socketMap.has(id)
      socketMap.set(id, (json: any) => {
        conn.socket.send(JSON.stringify(json))
      })

      if (isNew) {
        const worker = (await spawn(new Worker('../worker/process-upload.js')))
        logger.info(`Start processing: ${filename}`)

        worker.observable()
          .subscribe(
            (status) => {
              socketMap.get(id)!({ id, status })
              logger.info(`Processing status: ${filename}: ${status}`)
            },
            (err) => {
              socketMap.get(id)!({ id, error: err.message })
              logger.error(`Processing error: ${filename}: ${err.message}`)
            }
          )

        try {
          await worker.run({ id, type, filename })
        } catch (err) {
          socketMap.get(id)!({ id, error: err.message })
          logger.error(`Processing error: ${filename}: ${err.message}`)
          console.error(err)
        }

        socketMap.get(id)!({ id, status: 'done' })
        logger.info(`Finished processing: ${filename}`)
      }
    })
  })

  next()
}
