import Loki from 'lokijs'

interface Neutralino {
  init(
    load: () => void,
    pingSuccessCallback?: () => void,
    pingFailCallback?: () => void
  ): void;
  filesystem: {
    writeFile(
      filename: string,
      content: string,
      success: (data: { success: true }) => void,
      error?: (e: unknown) => void
    ): void;
    readFile(
      filename: string,
      success: (data: { content: string }) => void,
      error?: (e: unknown) => void
    ): void;
    removeFile(
      filename: string,
      success: (data: { success: true }) => void,
      error?: (e: unknown) => void
    ): void;
  };
}

declare global {
  interface Window {
    Neutralino?: Neutralino;
  }
}

class LokiNeutralinoAdaptor {
  constructor (private neu?: Neutralino) {}

  loadDatabase (dbname: string, callback: (data: string | null | Error) => void) {
    if (this.neu) {
      this.neu.filesystem.readFile(
        dbname,
        ({ content }) => callback(content || null),
        () => callback(new Error('Cannot load database'))
      )
    } else {
      fetch(`/api/db?filename=${encodeURIComponent(dbname)}`)
        .then((r) => r.text())
        .then((r) => callback(r))
        .catch((e) => callback(e))
    }
  }

  saveDatabase (dbname: string, dbstring: string, callback: (e: Error | null) => void) {
    if (this.neu) {
      this.neu.filesystem.writeFile(
        dbname,
        dbstring,
        () => callback(null),
        () => callback(new Error('Cannot save database'))
      )
    } else {
      fetch(`/api/db?filename=${encodeURIComponent(dbname)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify({
          content: dbstring
        })
      })
        .then(() => callback(null))
        .catch((e) => callback(e))
    }
  }

  deleteDatabase (dbname: string, callback: (data: Error | null) => void) {
    if (this.neu) {
      this.neu.filesystem.removeFile(
        dbname,
        () => callback(null),
        () => callback(new Error('Cannot delete database'))
      )
    } else {
      fetch(`/api/db?filename=${encodeURIComponent(dbname)}`, {
        method: 'DELETE'
      })
        .then(() => callback(null))
        .catch((e) => callback(e))
    }
  }
}

export async function initNeutralino () {
  const { Neutralino } = window
  if (Neutralino) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<Neutralino | undefined>(async (resolve) => {
      while (!Neutralino.init) {
        // eslint-disable-next-line promise/param-names
        await new Promise((r) => setTimeout(r, 100))
      }

      Neutralino.init(
        () => resolve(Neutralino),
        undefined,
        () => resolve()
      )
    })
  }
}

// eslint-disable-next-line import/no-mutable-exports
export let loki: Loki

export async function initDatabase (neu?: Neutralino) {
  return new Promise((resolve) => {
    loki = new Loki('db.loki', {
      adapter: new LokiNeutralinoAdaptor(neu),
      autoload: true,
      autoloadCallback: () => {
        resolve()
      },
      autosave: true,
      autosaveInterval: 4000
    })
  })
}
