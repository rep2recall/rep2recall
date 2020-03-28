<template lang="pug">
section.columns.editor
  .column(
    style="height: 100vh; overflow-y: scroll;"
    :class="hasPreview ? 'is-6' : 'is-12'"
    @scroll="onScroll"
  )
    b-collapse(class="card" animation="slide" aria-id="requiredHeader" style="margin-top: 1em; margin-bottom: 1em;")
      div(
        slot="trigger" slot-scope="props" class="card-header" role="button" aria-controls="requiredHeader"
      )
        p {{id}}
        div(style="flex-grow: 1;")
        .buttons.header-buttons(@click.stop)
          b-button.is-warning(@click="hasPreview = !hasPreview") {{hasPreview ? 'Hide' : 'Show'}} Preview
          b-button.is-success(:disabled="!isEdited" @click="save") Save
        a.card-header-icon
          b-icon(:icon="props.open ? 'caret-up' : 'caret-down'")
      .card-content
        b-field(label="Deck" label-position="on-border")
          b-input(v-model="deck")
        b-field(label="Tag" label-position="on-border")
          b-taginput(
            v-model="tag" ellipsis icon="tag" placeholder="Add a tag"
            allow-new open-on-focus :data="filteredTags" @typing="getFilteredTags"
          )
    codemirror(v-model="markdown" ref="codemirror" @input="onCmCodeChange" style="height: calc(100% - 90px);")
  .column.is-6(v-show="hasPreview")
    iframe(frameborder="0" style="height: 100%; width: 100%; padding: 1em;" ref="output")
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import dayjs from 'dayjs'
import Ajv from 'ajv'
import CodeMirror from 'codemirror'
import axios from 'axios'

import { normalizeArray } from '../utils'
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
  hasPreview = true
  isEdited = false
  markdown = ''
  scrollSize = 0
  guid = Math.random().toString(36).substr(2)

  deck = ''
  tag: string[] = []
  filteredTags: string[] = []
  allTags: string[] | null = []

  readonly matter = new Matter()

  get id () {
    return normalizeArray(this.$route.query.id)
  }

  get makeHtml () {
    return new MakeHtml(this.guid)
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
            const blob: File = item.getAsFile()
            const formData = new FormData()
            formData.append('file', blob)

            const cursor = ins.getCursor()

            const { data: r } = await axios.post('/api/media/upload', formData)
            ins.getDoc().replaceRange(`![${r.filename}](${r.url})`, cursor)
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

  formatDate (d: Date) {
    return dayjs(d).format('YYYY-MM-DD HH:mm Z')
  }

  getFilteredTags (text: string) {
    if (this.allTags) {
      this.filteredTags = this.allTags.filter((t) => {
        return t.toLocaleLowerCase().includes(text.toLocaleLowerCase())
      })
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
        h: { type: getType('string') },
        ref: { type: 'array', items: { type: getType('string') } },
        media: { type: 'array', items: { type: getType('string') } },
        data: { type: getType('object') },
        source: { type: getType('string') },
        link: { type: getType('string') },
        nextReview: { type: getType('string') },
        srsLevel: { type: getType('integer') },
        stat: { type: getType('object') }
      }
    })
    valid = !!validator(header)

    if (!valid) {
      for (const e of validator.errors || []) {
        this.$buefy.snackbar.open(JSON.stringify(e))
        console.error(e)
      }

      return null
    }

    return header as {
      tag?: string[]
      type?: string,
      data?: any
      deck?: string
      source?: string
      link?: string[]
    }
  }

  @Watch('$route.query.id')
  async load () {
    this.guid = Math.random().toString(36).substr(2)

    if (this.id) {
      const r = (await axios.get('/api/post/', {
        params: {
          id: this.id
        }
      }))

      if (r.data) {
        const { markdown, nextReview } = r.data

        const { header: rawHeader, content } = this.matter.parse(markdown)
        Object.assign(rawHeader, {
          nextReview: nextReview ? dayjs(nextReview).format('YYYY-MM-DD HH:mm Z') : undefined,
        })

        this.markdown = this.matter.stringify(content, rawHeader)

        setTimeout(() => {
          this.isEdited = false
        }, 100)
      }
    }
  }

  async save () {
    if (!this.canSave) {
      return
    }

    const header = this.getAndValidateHeader(true)

    if (!header) {
      return
    }

    const content = {
      markdown: this.markdown,
      ...header
    }

    if (!this.id) {
      /**
       * Create a post
       */
      const r = await axios.put('/api/post/', content)

      this.$router.push({
        query: {
          id: r.data.id
        }
      })
    } else {
      await axios.patch('/api/post/', {
        id: this.id,
        update: content
      })
    }

    this.$buefy.snackbar.open('Saved')

    setTimeout(() => {
      this.isEdited = false
    }, 100)
  }

  onCmCodeChange () {
    this.isEdited = true
    this.getAndValidateHeader(false)

    if (this.outputWindow) {
      const document = this.outputWindow.document
      this.makeHtml.render(document.body, this.markdown)
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
  display: block;
  margin-bottom: 0 !important;
  align-self: center;

  > .button {
    margin-bottom: 0 !important;
  }
}
</style>
