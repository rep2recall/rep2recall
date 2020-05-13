import path from 'path'
import { Worker } from 'worker_threads'

import { FastifyInstance } from 'fastify'
import ws from 'fastify-websocket'
// @ts-ignore
import fileUpload from 'fastify-file-upload'
import { nanoid } from 'nanoid'
import { UploadedFile } from 'express-fileupload'

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
  f.get('/process', {
    websocket: true,
    schema: {
      tags: ['file'],
      summary: 'Process an archive'
    }
  }, (conn) => {
    conn.socket.on('message', (msg: string) => {
      const { id, type, filename } = JSON.parse(msg)

      const isNew = !socketMap.has(id)
      socketMap.set(id, (json: any) => {
        conn.socket.send(JSON.stringify(json))
      })

      if (isNew) {
        const spawn = () => {
          const worker = new Worker(path.join(__dirname, '../worker/process-upload.js'))

          worker
            .on('online', () => {
              worker.postMessage({ id, type, filename })
            })
            .on('message', (status = 'done') => {
            socketMap.get(id)!({ id, status })
            })
            .on('error', (err) => {
              console.error(`Error: ${filename}, ${err.message}`)
            })
            .on('exit', (code) => {
              if (code === 0) {
                console.log(`Worker: ${filename} exited with code ${code}`)
                socketMap.get(id)!({ id, status: 'done' })
              } else {
                console.error(`Worker: ${filename} exited with code ${code}`)
              }
            })
        }

        spawn()
      }
    })
  })

  next()
}
