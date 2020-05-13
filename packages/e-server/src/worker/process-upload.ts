import path from 'path'

import AdmZip from 'adm-zip'
import { expose } from 'threads/worker'
import { Subject, Observable } from 'threads/observable'

import { tmpPath, db } from '../config'
import { Db } from '../db/local'

const subject = new Subject()

expose({
  run ({ id, type, filename }) {
    if (type === 'apkg') {
      const zip = new AdmZip(path.join(tmpPath, id))
      subject.next('extracting APKG')
      zip.extractAllTo(path.join(tmpPath, id + '-folder'))
      db.importAnki2(path.join(tmpPath, id + '-folder', 'collection.anki2'), (msg) => subject.next(msg), { filename })
    } else if (type === 'anki2') {
      db.importAnki2(path.join(tmpPath, id), (msg) => subject.next(msg), { filename })
    } else {
      const src = new Db(path.join(tmpPath, id))
      db.import(src, (msg) => subject.next(msg))
    }

    subject.complete()
  },
  observable () {
    return Observable.from(subject)
  }
})
