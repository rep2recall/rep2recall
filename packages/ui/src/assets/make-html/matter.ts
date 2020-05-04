import yaml from 'js-yaml'
import dayjs from 'dayjs'

export class Matter {
  header = {} as any

  parse (s: string) {
    const m = /^---\n(.+?)\n---\n(.+)$/s.exec(s)
    if (m) {
      try {
        this.header = yaml.safeLoad(m[1] || '', {
          schema: yaml.JSON_SCHEMA
        }) || {}

        if (typeof this.header !== 'object') {
          this.header = {}
        }
      } catch (_) {}

      return {
        header: this.header,
        content: m[2]
      }
    }

    return {
      header: {},
      content: s
    }
  }

  stringify (content: string, header: any) {
    if (header && typeof header === 'object' && Object.keys(header).length > 0) {
      const doReplace = (obj: any): any => {
        if (obj) {
          if (obj instanceof Date) {
            return dayjs(obj).format('YYYY-MM-DD HH:mm Z')
          } else if (Array.isArray(obj)) {
            return obj.map((a) => doReplace(a))
          } else if (typeof obj === 'object') {
            const obj1 = {} as any
            Object.entries(obj).map(([k, v]) => {
              if (v && ['nextReview', 'lastRight', 'lastWrong'].includes(k)) {
                obj1[k] = dayjs(v as string).format('YYYY-MM-DD HH:mm Z')
                return
              }

              obj1[k] = doReplace(v)
            })
            return obj1
          }
        }

        return obj
      }

      try {
        return `---\n${yaml.safeDump(doReplace(header), {
          schema: yaml.JSON_SCHEMA,
          skipInvalid: true
        })}---\n${content}`
      } catch (e) {
        console.error(e)
      }
    }

    return content
  }
}
