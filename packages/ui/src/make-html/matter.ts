import yaml from 'js-yaml'

export class Matter {
  header = {} as any

  parse (s: string) {
    const m = /^---\n(.+?)\n---\n(.+)$/s.exec(s)
    if (m) {
      try {
        this.header = yaml.safeLoad(m[1] || '', {
          schema: yaml.JSON_SCHEMA,
        }) || {}

        if (typeof this.header !== 'object') {
          this.header = {}
        }
      } catch (_) {}

      return {
        header: this.header,
        content: m[2],
      }
    }

    return {
      header: {},
      content: s,
    }
  }

  stringify (content: string, header: any) {
    if (header && typeof header === 'object' && Object.keys(header).length > 0) {
      try {
        return `---\n${yaml.safeDump(header, {
          schema: yaml.JSON_SCHEMA,
          skipInvalid: true,
        })}---\n${content}`
      } catch (e) {
        console.error(e)
      }
    }

    return content
  }
}
