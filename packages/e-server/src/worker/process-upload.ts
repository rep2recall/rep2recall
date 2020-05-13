import { parentPort } from 'worker_threads'
import path from 'path'

import AdmZip from 'adm-zip'

import { tmpPath, db } from '../config'
import { Db } from '../db/local'

const parent = parentPort!

const postMessage = (msg: string) => parent.postMessage(msg)

parent.on('message', ({ id, type, filename }) => {
  if (type === 'apkg') {
    const zip = new AdmZip(path.join(tmpPath, id))
    postMessage('extracting APKG')
    zip.extractAllTo(path.join(tmpPath, id + '-folder'))
    db.importAnki2(path.join(tmpPath, id + '-folder', 'collection.anki2'), postMessage, { filename })
  } else if (type === 'anki2') {
    db.importAnki2(path.join(tmpPath, id), postMessage, { filename })
  } else {
    const src = new Db(path.join(tmpPath, id))
    db.import(src, postMessage)
  }
  process.exit()
})
