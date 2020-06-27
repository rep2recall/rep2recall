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
      :class="hasPreview ? ($mq === 'lg' ? 'is-6' : 'u-none') : 'is-12'"
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
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import dayjs from 'dayjs'
import CodeMirror from 'codemirror'
import hbs from 'handlebars'
import axios from 'axios'
import {
  normalizeArray,
  nullifyObject,
  stringSorter,
  deepMerge
} from '@/assets/util'
import { Matter } from '@/assets/make-html/matter'
import MakeHtml from '@/assets/make-html'

@Component<Edit>({
  layout: 'dashboard',
  beforeRouteLeave(_to, _from, next) {
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
  key = Math.random()
    .toString(36)
    .substr(2)

  tag: string[] = []
  filteredTags: string[] = []
  allTags: string[] | null = null

  ctx = {} as any

  readonly matter = new Matter()

  get title() {
    return this.matter.header.key || this.$route.query.key
  }

  get makeHtml() {
    return new MakeHtml(this.key)
  }

  get codemirror(): CodeMirror.Editor {
    return (this.$refs.codemirror as any).codemirror
  }

  get outputWindow() {
    const output = this.$refs.output as HTMLIFrameElement
    if (output) {
      return output.contentWindow
    }

    return null
  }

  get canSave() {
    return this.isEdited
  }

  created() {
    // @ts-ignore
    this.hasPreview = this.$mq === 'lg'
    this.load()
  }

  mounted() {
    this.isEdited = false
    this.codemirror.setSize('100%', '100%')
    this.codemirror.addKeyMap({
      'Cmd-S': () => {
        this.save()
      },
      'Ctrl-S': () => {
        this.save()
      }
    })

    // @ts-ignore
    this.codemirror.on('paste', async (ins, evt) => {
      const { items } = evt.clipboardData || ({} as any)
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

            const snapshot = await this.$fireStorage
              .ref()
              .child(filename)
              .put(f)
            ins
              .getDoc()
              .replaceRange(`![${filename}](${snapshot.downloadURL})`, cursor)
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

  beforeDestroy() {
    window.onbeforeunload = null
  }

  formatDate(d: Date) {
    return dayjs(d).format('YYYY-MM-DD HH:mm Z')
  }

  async initFilteredTags() {
    if (!this.allTags) {
      this.allTags = (await this.$axios.$get('/api/edit/tag')).tags
    }
    this.allTags = stringSorter(
      Array.from(new Set([...this.allTags!, ...this.tag]))
    )
  }

  getFilteredTags(text?: string) {
    if (this.allTags) {
      this.filteredTags = text
        ? this.allTags.filter((t) => {
            return (
              t &&
              !this.tag.includes(t) &&
              t.toLocaleLowerCase().includes(text.toLocaleLowerCase())
            )
          })
        : this.allTags
    }
  }

  @Watch('$route.query.key')
  async load() {
    let isSet = false

    if (this.$route.query.key) {
      this.key = normalizeArray(this.$route.query.key)!

      const r = await this.$axios.$get('/api/edit/', {
        params: {
          key: this.key
        }
      })

      if (r) {
        const {
          tag,
          key,
          lesson,
          data,
          deck,
          nextReview,
          srsLevel,
          stat,
          markdown
        } = r.data

        const { header, content } = this.matter.parse(markdown)
        this.ctx[this.key] = r.data

        const ref = deepMerge(r.data.ref, header.ref)
        await this.onCtxChange(ref)

        this.markdown = this.matter.stringify(
          content,
          nullifyObject(
            deepMerge(
              {
                key,
                ref,
                deck,
                lesson,
                data,
                srsLevel,
                stat,
                nextReview
              },
              header
            )
          )
        )

        this.$set(this, 'tag', tag)
        isSet = true
      }
    } else {
      this.key = Math.random()
        .toString(36)
        .substr(2)
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

  async save() {
    if (!this.canSave) {
      return
    }

    let { content: markdown } = this.matter.parse(this.markdown)
    markdown = this.matter.stringify(
      markdown,
      Object.entries(this.matter.header)
        .filter(([k]) => !['key', 'ref', 'data', 'quiz', 'deck'].includes(k))
        .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {} as any)
    )

    const { key, ref, data, quiz, deck } = this.matter.header

    const content = {
      key,
      ref:
        typeof ref === 'object'
          ? Array.isArray(ref)
            ? ref
            : Object.keys(ref).filter((k) => ref[k] === null)
          : undefined,
      data,
      quiz,
      deck,
      markdown,
      tag: this.tag
    }

    if (!this.$route.query.key) {
      /**
       * Create a post
       */
      const r = await this.$axios.$put('/api/edit/', content)
      this.key = r.key
    } else {
      await this.$axios.$patch('/api/edit/', {
        keys: [this.key],
        set: content
      })

      this.key = this.matter.header.key || this.key
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

  onCmCodeChange() {
    this.isEdited = true
    this.key = this.key || this.matter.header.key

    if (this.outputWindow) {
      const document = this.outputWindow.document
      this.makeHtml.patch(
        document.body,
        hbs.compile(new Matter().parse(this.markdown).content)({
          [this.key]: self,
          ...this.ctx
        })
      )
      this.outputWindow.document
        .querySelectorAll('script:not([data-loaded])')
        .forEach((el) => {
          el.setAttribute('data-loaded', '1')

          const el1 = el.cloneNode(true) as HTMLScriptElement
          el.replaceWith(el1)
        })
    }
  }

  @Watch('deck')
  @Watch('tag', { deep: true })
  onHeaderChange() {
    this.isEdited = true
  }

  async ctxReload() {
    const { header, content } = new Matter().parse(this.markdown)
    this.ctx[this.key] = content

    const { ref } = deepMerge(header.ref)
    await this.onCtxChange(ref)
  }

  async onCtxChange(ctx: Record<string, any>) {
    if (Array.isArray(ctx)) {
      ctx = ctx.reduce((prev, c) => ({ ...prev, [c]: null }), {})
    }

    await Promise.all(
      Object.entries(ctx).map(async ([key, data]) => {
        if (typeof data !== 'undefined' && !this.ctx[key]) {
          if (!data) {
            const r = await this.$axios.$get('/api/edit/', {
              params: {
                key
              }
            })
            this.ctx[key] = r
            this.ctx[key].markdown = new Matter().parse(
              r.data.markdown || ''
            ).content
          } else if (typeof data === 'string') {
            this.ctx[key] = (await axios.get(data)).data
          } else if (data.url) {
            this.ctx[key] = (await axios(data)).data
          }
        }
      })
    )
  }

  onScroll(evt: any) {
    this.scrollSize =
      evt.target.scrollTop / (evt.target.scrollHeight - evt.target.clientHeight)
  }
}
</script>

<style lang="scss" scoped>
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
  width: 100%;

  > .button {
    margin-bottom: 0 !important;
  }
}

.vue-codemirror {
  height: 100%;
}

.CodeMirror-scroll {
  min-height: calc(100vh - 200px);
}

.editor {
  margin-top: 1em;
  display: flex;
  flex-direction: column;
}

@media screen and (max-width: 800px) {
  .editor {
    margin-top: unset;
  }
}
</style>
