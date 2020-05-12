<template lang="pug">
section.editor
  .buttons.header-buttons
    div(style="flex-grow: 1;")
    b-button.is-info(@click="ctxReload()") Reload
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
import CodeMirror from 'codemirror'
import axios, { AxiosInstance } from 'axios'
import hbs from 'handlebars'
import * as z from 'zod'
import { normalizeArray, nullifyObject, stringSorter, deepMerge } from '@/assets/util'
import { Matter } from '@/assets/make-html/matter'
import MakeHtml from '@/assets/make-html'

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
  key = ''

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

            const api = await this.getApi()

            const formData = new FormData()
            formData.append('file', f)
            if (this.key) {
              formData.append('key', this.key)
            }

            const r = await api.post('/api/media/upload', formData)
            const { filename } = r.data

            ins.getDoc().replaceRange(`![${filename}](/media/${filename})`, cursor)

            const { media = [] } = this.matter.header || {}
            media.push(filename)
            this.appendHeader({ media })
          }
        }
      }
    })

    // window.onbeforeunload = (e: any) => {
    //   const msg = this.canSave ? 'Please save before leaving.' : null
    //   if (msg) {
    //     e.returnValue = msg
    //     return msg
    //   }
    // }
  }

  // beforeDestroy () {
  //   window.onbeforeunload = null
  // }

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

  getAndValidateHeader (isFinal?: boolean) {
    try {
      let { header: { key, ref, media, srsLevel, data, stat, deck, nextReview } } = this.matter.parse(this.markdown)

      if (nextReview) {
        const d = dayjs(z.string().parse(nextReview))
        if (!d.isValid()) {
          throw new Error(`Invalid Date: ${nextReview}`)
        }

        nextReview = d.toISOString()
      }

      return {
        key: z.string().optional().parse(key),
        ref: z.union([
          z.record(z.any()),
          z.array(z.string())
        ]).parse(ref || {}),
        media: z.array(z.string()).optional(),
        srsLevel: z.number().nullable().optional().parse(srsLevel),
        data: z.record(z.any()).parse(data || {}),
        stat: z.record(z.any()).parse(stat || {}),
        deck: z.string().optional().parse(deck),
        nextReview: z.string().optional().parse(nextReview)
      }
    } catch (e) {
      if (isFinal) {
        this.$buefy.snackbar.open(e.message)
      }
    }

    return null
  }

  @Watch('$route.query.key')
  async load () {
    let isSet = false

    if (this.$route.query.key) {
      this.key = normalizeArray(this.$route.query.key)!

      const api = await this.getApi()

      const r = (await api.post('/api/edit/info', { key: this.key }))

      console.log(r)

      if (r.data) {
        const {
          tag,
          key, lesson, data, deck,
          nextReview, srsLevel, stat,
          markdown
        } = r.data

        const { header, content } = this.matter.parse(markdown)
        this.ctx[this.key] = r.data

        const ref = deepMerge(r.data.ref, header.ref)
        await this.onCtxChange(ref)

        this.markdown = this.matter.stringify(content, nullifyObject(deepMerge({
          key,
          ref,
          deck,
          lesson,
          data,
          srsLevel,
          stat,
          nextReview
        }, header)))

        this.$set(this, 'tag', tag)
        isSet = true
      }
    } else {
      this.key = ''
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

  appendHeader (h1: any) {
    const { header, content } = this.matter.parse(this.markdown)
    this.markdown = this.matter.stringify(content, deepMerge(header, h1))
  }

  async save () {
    if (!this.canSave) {
      return
    }

    const header = this.getAndValidateHeader(true)

    if (!header) {
      return
    }

    const { key, ref, data, srsLevel, stat, nextReview, deck } = header

    let { content: markdown } = this.matter.parse(this.markdown)
    markdown = this.matter.stringify(markdown, Object.entries(header)
      .filter(([k]) => !['key', 'ref', 'data', 'srsLevel', 'stat', 'nextReview', 'lesson'].includes(k))
      .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {} as any))

    const content = {
      key,
      ref: typeof ref === 'object'
        ? Array.isArray(ref)
          ? ref
          : Object.keys(ref).filter((k) => ref[k] === null)
        : undefined,
      data,
      srsLevel,
      stat,
      nextReview,
      deck,
      markdown,
      tag: this.tag
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

  onCmCodeChange () {
    this.isEdited = true
    const self = this.getAndValidateHeader(false)
    this.key = this.key || this.matter.header.key

    if (this.outputWindow) {
      this.onCtxChange({
        [this.key]: self,
        ...this.ctx
      })

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

  async ctxReload () {
    const { header, content } = new Matter().parse(this.markdown)
    this.ctx[this.key] = content

    const { ref } = deepMerge(header.ref)
    await this.onCtxChange(ref)
  }

  async onCtxChange (ctx: Record<string, any>) {
    if (Array.isArray(ctx)) {
      ctx = ctx.reduce((prev, c) => ({ ...prev, [c]: null }), {})
    }

    await Promise.all(Object.entries(ctx).map(async ([key, data]) => {
      if (typeof data !== 'undefined' && !this.ctx[key]) {
        if (!data) {
          const api = await this.getApi(true)
          const r = await api.post('/api/edit/info', { key })
          this.ctx[key] = r.data
          this.ctx[key].markdown = new Matter().parse(r.data.markdown || '').content
        } else {
          if (typeof data === 'string') {
            this.ctx[key] = (await axios.get(data)).data
          } else if (data.url) {
            this.ctx[key] = (await axios(data)).data
          }
        }
      }
    }))
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

.CodeMirror-line {
  word-break: break-all !important;
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
