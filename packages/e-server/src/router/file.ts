import path from 'path'

import { FastifyInstance } from 'fastify'
import ws from 'fastify-websocket'
// @ts-ignore
import fileUpload from 'fastify-file-upload'
import { nanoid } from 'nanoid'
import { UploadedFile } from 'express-fileupload'
import AdmZip from 'adm-zip'
import pino from 'pino'

import { tmpPath, db } from '../config'

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
  }, (conn, _, params = {}) => {
    const logger = pino({
      prettyPrint: true
    })
    const id = params.id as string

    conn.socket.on('message', async (msg: string) => {
      const { type, filename } = JSON.parse(msg)

      const isNew = !socketMap.has(id)
      socketMap.set(id, (json: any) => {
        conn.socket.send(JSON.stringify(json))
      })

      if (isNew) {
        try {
          const sendStatus = ({ message, percent }: { message: string; percent?: number }) => {
            socketMap.get(id)!({ id, message, percent })
            logger.info(`Processing status: ${filename}: ${message}${percent ? ` : ${percent.toFixed(2)}%` : ''}`)
          }
          const sendError = (err: Error) => {
            socketMap.get(id)!({ id, status: 'error', message: err.message })
            logger.error(`Processing error: ${filename}: ${err.message}`)
            console.error(err)
          }
          const sendComplete = () => {
            socketMap.get(id)!({ id, status: 'complete' })
            logger.info(`Finished processing: ${filename}`)
          }

          logger.info(`Start processing: ${filename}`)

          if (type === 'apkg') {
            const zip = new AdmZip(path.join(tmpPath, id))
            sendStatus({ message: 'extracting APKG' })
            zip.extractAllTo(path.join(tmpPath, id + '-folder'))

            db.importAnki2(path.join(tmpPath, id + '-folder', 'collection.anki2'), {
              originalFilename: filename
            })
              .subscribe(
                sendStatus,
                sendError,
                sendComplete
              )
          } else if (type === 'anki2') {
            db.importAnki2(path.join(tmpPath, id), {
              originalFilename: filename
            })
              .subscribe(
                sendStatus,
                sendError,
                sendComplete
              )
          } else {
            throw new Error('Not implemented yet.')
            // db.import(path.join(tmpPath, id))
            //   .subscribe(
            //     sendStatus,
            //     sendError,
            //     sendComplete
            //   )
          }
        } catch (err) {
          socketMap.get(id)!({ id, error: err.message })
          logger.error(`Processing error: ${filename}: ${err.message}`)
          console.error(err)
        }
      }
    })
  })

  next()
}
