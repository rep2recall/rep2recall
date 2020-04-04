<template lang="pug">
section.editor
  .buttons.header-buttons
    div(style="flex-grow: 1;")
    b-button.is-warning(@click="hasPreview = !hasPreview") {{hasPreview ? 'Hide' : 'Show'}} Preview
    b-button.is-success(:disabled="!isEdited" @click="save") Save
  .columns
    .column(
      style="height: calc(100vh - 60px); overflow-y: scroll;"
      :class="hasPreview ? ($mq === 'lg' ? 'is-6' : 'd-none') : 'is-12'"
      @scroll="onScroll"
    )
      b-collapse(class="card" animation="slide" aria-id="requiredHeader" style="margin-bottom: 1em;")
        div(
          slot="trigger" slot-scope="props" class="card-header" role="button" aria-controls="requiredHeader"
        )
          h1.card-header-title(style="font-family: monospace;") {{title}}
          a.card-header-icon
            b-icon(:icon="props.open ? 'caret-up' : 'caret-down'")
        .card-content
          b-field(label="Tag" label-position="on-border")
            b-taginput(
              v-model="tag" ellipsis icon="tag" placeholder="Add a tag"
              allow-new open-on-focus :data="filteredTags" @focus="initFilteredTags" @typing="getFilteredTags"
            )
      codemirror(v-model="markdown" ref="codemirror" @input="onCmCodeChange")
    .column.is-6(v-show="hasPreview")
      iframe(frameborder="0" style="height: 100%; width: 100%; padding: 1em;" ref="output")
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import dayjs from 'dayjs'
import Ajv from 'ajv'
import CodeMirror from 'codemirror'
import { AxiosInstance } from 'axios'
import firebase from 'firebase/app'
import hbs from 'handlebars'

import 'firebase/storage'

import { normalizeArray, nullifyObject, stringSorter } from '../utils'
import { Matter } from '../make-html/matter'
import MakeHtml from '../make-html'

@Component<Edit>({
  beforeRouteLeave (to, from, next) {
    const msg = this.canSave ? 'Please save before leaving.' : null

    if (msg) {
      this.$buefy.dialog.confirm({
        message: msg,
        confirmText: 'Leave',
        cancelText: 'Cancel',
        onConfirm: () => next(),
        onCancel: () => next(false)
      })
    } else {
      next()
    }
  }
})
export default class Edit extends Vue {
  hasPreview = false
  isEdited = false
  markdown = ''
  scrollSize = 0
  key = Math.random().toString(36).substr(2)

  tag: string[] = []
  filteredTags: string[] = []
  allTags: string[] | null = null

  ctx = {} as any

  readonly matter = new Matter()

  get title () {
    return this.matter.header.key || this.$route.query.key
  }

  get makeHtml () {
    return new MakeHtml(this.key)
  }

  get codemirror (): CodeMirror.Editor {
    return (this.$refs.codemirror as any).codemirror
  }

  get outputWindow () {
    const output = this.$refs.output as HTMLIFrameElement
    if (output) {
      return output.contentWindow
    }

    return null
  }

  get canSave () {
    return this.isEdited
  }

  created () {
    this.hasPreview = this.$mq === 'lg'
    this.load()
  }

  mounted () {
    this.isEdited = false
    this.codemirror.setSize('100%', '100%')
    this.codemirror.addKeyMap({
      'Cmd-S': () => { this.save() },
      'Ctrl-S': () => { this.save() }
    })

    // @ts-ignore
    this.codemirror.on('paste', async (ins, evt) => {
      const { items } = evt.clipboardData || {} as any
      if (items) {
        for (const k of Object.keys(items)) {
          const item = items[k]
          if (item.kind === 'file') {
            evt.preventDefault()
            const f: File = item.getAsFile()

            const cursor = ins.getCursor()
            let filename = f.name

            if (filename === 'image.png') {
              filename = dayjs().format('YYYYMMDD-HHmm') + '.png'
            }

            const snapshot = await firebase.storage().ref().child(filename).put(f)
            ins.getDoc().replaceRange(`![${filename}](${snapshot.downloadURL})`, cursor)
          }
        }
      }
    })

    window.onbeforeunload = (e: any) => {
      const msg = this.canSave ? 'Please save before leaving.' : null
      if (msg) {
        e.returnValue = msg
        return msg
      }
    }
  }

  beforeDestroy () {
    window.onbeforeunload = null
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  formatDate (d: Date) {
    return dayjs(d).format('YYYY-MM-DD HH:mm Z')
  }

  async initFilteredTags () {
    if (!this.allTags) {
      const api = await this.getApi(true)
      this.allTags = (await api.get('/api/edit/tag')).data.tags
    }
    this.allTags = stringSorter(Array.from(new Set([...this.allTags!, ...this.tag])))
  }

  async getFilteredTags (text?: string) {
    if (this.allTags) {
      this.filteredTags = text ? this.allTags
        .filter((t) => {
          return t && !this.tag.includes(t) && t.toLocaleLowerCase().includes(text.toLocaleLowerCase())
        }) : this.allTags
    }
  }

  getAndValidateHeader (isFinal = true) {
    const { header } = this.matter.parse(this.markdown)

    let valid = true

    if (header.nextReview && isFinal) {
      let d = dayjs(header.nextReview)
      valid = d.isValid()
      if (!valid) {
        this.$buefy.snackbar.open(`Invalid Date: ${header.nextReview}`)
        console.error(`Invalid Date: ${header.nextReview}`)
        return
      }

      if (header.date instanceof Date) {
        d = d.add(new Date().getTimezoneOffset(), 'minute')
      }

      header.nextReview = d.toISOString()
    }

    const ajv = new Ajv()
    const getType = (t: string) => isFinal ? t : [t, 'null']
    const validator = ajv.compile({
      type: 'object',
      properties: {
        key: { type: getType('string') },
        ref: { type: 'array', items: { type: getType('string') } },
        data: { type: getType('object') },
        nextReview: { type: getType('string') },
        srsLevel: { type: getType('integer') },
        stat: { type: getType('object') },
        lesson: {
          type: 'object',
          items: {
            type: 'object',
            required: ['key', 'name', 'deck'],
            properties: {
              key: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              deck: { type: 'string' }
            }
          }
        }
      }
    })
    valid = !!validator(header)

    if (!valid) {
      // for (const e of validator.errors || []) {
      //   this.$buefy.snackbar.open(e.message || '')
      //   console.error(e)
      // }
      return null
    }

    return header as {
      key?: string
      ref?: string[]
      data?: Record<string, any>
      nextReview?: string
      srsLevel?: number
      stat?: any
      lesson?: {
        key: string
        name: string
        deck: string
        description?: string
      }[]
    }
  }

  @Watch('$route.query.key')
  async load () {
    let isSet = false

    if (this.$route.query.key) {
      this.key = normalizeArray(this.$route.query.key)!

      const api = await this.getApi()

      const r = (await api.get('/api/edit/', {
        params: {
          key: this.key
        }
      }))

      if (r.data) {
        const {
          tag,
          key, ref, lesson, data,
          nextReview, srsLevel, stat,
          markdown,
        } = r.data

        const { header, content } = this.matter.parse(markdown)
        Object.assign(header, {
          key, ref, lesson, data,
          srsLevel, stat,
          nextReview,
        })

        this.markdown = this.matter.stringify(content, nullifyObject(header))
        this.$set(this, 'tag', tag)
        isSet = true
      }
    } else {
      this.key = Math.random().toString(36).substr(2)
      this.matter.header = {}
    }

    if (!isSet) {
      this.markdown = ''
      this.$set(this, 'tag', [])
    }

    setTimeout(() => {
      this.isEdited = false
    }, 100)
  }

  async save () {
    if (!this.canSave) {
      return
    }

    const header = this.getAndValidateHeader(true)

    if (!header) {
      return
    }

    const { key, ref, data, srsLevel, stat, nextReview, lesson } = header

    let { content: markdown } = this.matter.parse(this.markdown)
    markdown = this.matter.stringify(markdown, Object.entries(header)
      .filter(([k]) => !['key', 'ref', 'data', 'srsLevel', 'stat', 'nextReview', 'lesson'].includes(k))
      .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {} as any))

    const content = {
      key, ref, data, srsLevel, stat, nextReview, lesson,
      markdown,
      tag: this.tag,
    }

    const api = await this.getApi()

    if (!this.$route.query.key) {
      /**
       * Create a post
       */
      const r = await api.put('/api/edit/', content)
      this.key = r.data.key
    } else {
      await api.patch('/api/edit/', {
        keys: [this.key],
        set: content
      })

      this.key = header.key || this.key
    }

    this.initFilteredTags()

    if (this.$route.query.key !== this.key) {
      this.$router.push({
        query: {
          key: this.key
        }
      })
    }

    this.$buefy.snackbar.open('Saved')

    setTimeout(() => {
      this.isEdited = false
    }, 100)
  }

  async onCmCodeChange () {
    this.isEdited = true
    const self = this.getAndValidateHeader(false)
    this.key = this.key || this.matter.header.key

    await Promise.all((this.matter.header.ref || []).map((r0: string) => this.onCtxChange(r0)))

    if (this.outputWindow) {
      const document = this.outputWindow.document
      this.makeHtml.patch(document.body, hbs.compile(new Matter().parse(this.markdown).content)({
        [this.key]: self,
        ...this.ctx
      }))
      this.outputWindow.document.querySelectorAll('script:not([data-loaded])').forEach((el) => {
        el.setAttribute('data-loaded', '1')

        const el1 = el.cloneNode(true) as HTMLScriptElement
        el.replaceWith(el1)
      })
    }
  }

  @Watch('deck')
  @Watch('tag', { deep: true })
  onHeaderChange () {
    this.isEdited = true
  }

  async onCtxChange (key: string) {
    if (!this.ctx[key]) {
      const api = await this.getApi(true)
      try {
        const r = await api.get('/api/edit/', {
          params: {
            key
          }
        })
        this.ctx[key] = r.data
        this.ctx[key].markdown = new Matter().parse(r.data.markdown || '').content
      } catch (_) {}
    }
  }

  onScroll (evt: any) {
    this.scrollSize = evt.target.scrollTop / (evt.target.scrollHeight - evt.target.clientHeight)
  }
}
</script>

<style lang="scss">
.header-buttons {
  white-space: nowrap;
  display: flex;
  padding-left: 1em;
  padding-right: 1em;
  padding-bottom: 5px;
  margin-bottom: 1em !important;
  align-self: center;
  justify-content: flex-end;
  box-shadow: 0 1px #ccc;

  > .button {
    margin-bottom: 0 !important;
  }
}

.CodeMirror-scroll {
  min-height: calc(100vh - 200px);
}

.d-none {
  display: none;
}

.editor {
  margin-top: 1em;
}

@media screen and (max-width: 800px) {
  .editor {
    margin-top: unset;
  }
}
</style>
