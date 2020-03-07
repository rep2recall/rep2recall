declare global {
  interface Window {
    NL_MODE: string
    NL_NAME: string
    NL_OS: string
    NL_PORT: string
    NL_TOKEN: string
    NL_VERSION: string

    Neutralino: {
      init(callbacks: {
        load?: () => void
        pingSuccessCallback?: () => void
        pingFailCallback?: () => void
      }): void

      /**
       * https://neutralino.js.org/docs/#/api/settings
       * @param onSuccess
       * @param onError?
       */
      getSettings(
        onSuccess: (settingsData: any) => void,
        onError?: () => void
      ): void

      /**
       * https://neutralino.js.org/docs/#/api/filesystem
       */
      filesystem: {
        createDirectory: (
          dirName: string,
          onSuccess: (data: {
            stdout: string
          }) => void,
          onError?: () => void
        ) => void
        removeDirectory: (
          dirName: string,
          onSuccess: (data: {
            stdout: string
          }) => void,
          onError?: () => void
        ) => void
        readDirectory: (
          dirName: string,
          onSuccess: (data: {
            files: {
              name: string
              type: string
            }[]
          }) => void,
          onError?: () => void
        ) => void
        writeFile: (
          filename: string,
          content: string,
          onSuccess: (data: {
            stdout: string
          }) => void,
          onError?: () => void
        ) => void
        readFile: (
          filename: string,
          onSuccess: (data: {
            stdout: string
          }) => void,
          onError?: () => void
        ) => void
        removeFile: (
          filename: string,
          onSuccess: (data: {
            stdout: string
          }) => void,
          onError?: () => void
        ) => void
      }

      os: {
        runCommand: (
          command: string,
          onSuccess: (data: {
            stdout: string
          }) => void,
          onError?: () => void
        ) => void
        getEnvar: (
          key: string,
          onSuccess: (data: {
            value: string
          }) => void,
          onError?: () => void
        ) => void
        dialogOpen: (
          title: string,
          onSuccess: (data: {
            file: string
          }) => void,
          onError?: () => void
        ) => void
        dialogSave: (
          title: string,
          onSuccess: (data: {
            file: string
          }) => void,
          onError?: () => void
        ) => void
      }

      /**
       * https://neutralino.js.org/docs/#/api/computer
       */
      computer: {
        getRamUsage: (
          onSuccess: (data: {
            raw: {
              available: number
              total: number
            }
          }) => void,
          onError?: () => void
        ) => void
      }

      /**
       * https://neutralino.js.org/docs/#/api/storage
       */
      storage: {
        putData: (
          data: {
            bucket: string
            content: any
          },
          onSuccess: (data: {
            raw: {
              available: number
              total: number
            }
          }) => void,
          onError?: () => void
        ) => void
        getData: (
          key: string,
          onSuccess: (data: {
            raw: {
              available: number
              total: number
            }
          }) => void,
          onError?: () => void
        ) => void
      }

      /**
       * https://neutralino.js.org/docs/#/api/debug
       */
      debug: {
        log: (
          logType: 'INFO' | 'ERROR' | 'WARN',
          message: string,
          onSuccess: (data: {
            message: string
          }) => void,
          onError?: () => void
        ) => void
      }

      app: {
        exit: (
          onSuccess: (data: {
            message: string
          }) => void,
          onError?: () => void
        ) => void
      }
    }
  }
}

export {}
