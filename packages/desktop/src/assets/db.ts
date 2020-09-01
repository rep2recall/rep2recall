import Loki from 'lokijs'

class LokiRestAdaptor {
  loadDatabase (dbname: string, callback: (data: string | null | Error) => void) {
    fetch(`/api/file?filename=${encodeURIComponent(dbname)}`)
      .then((r) => r.text())
      .then((r) => callback(r))
      .catch((e) => callback(e))
  }

  saveDatabase (dbname: string, dbstring: string, callback: (e: Error | null) => void) {
    fetch(`/api/file?filename=${encodeURIComponent(dbname)}`, {
      method: 'PUT',
      body: dbstring
    })
      .then(() => callback(null))
      .catch((e) => callback(e))
  }

  deleteDatabase (dbname: string, callback: (data: Error | null) => void) {
    fetch(`/api/db?filename=${encodeURIComponent(dbname)}`, {
      method: 'DELETE'
    })
      .then(() => callback(null))
      .catch((e) => callback(e))
  }
}

// eslint-disable-next-line import/no-mutable-exports
export let loki: Loki

export async function initDatabase () {
  return new Promise((resolve) => {
    loki = new Loki('db.loki', {
      adapter: new LokiRestAdaptor(),
      autoload: true,
      autoloadCallback: () => {
        resolve()
      },
      autosave: true,
      autosaveInterval: 4000
    })
  })
}
