<template lang="pug">
.container
  .columns
    .column(:class="$mq === 'lg' ? 'is-10 is-offset-1' : ''")
      form.field(@submit.prevent="onSearch")
        label.label
          span Search
          b-tooltip(label="Click here to learn how to search" position="is-right")
            a.button.is-text(href="https://github.com/patarapolw/qsearch" target="_blank" style="font-size: 13px;") ?
        div.control.has-icons-left
          input.input(
            type="search" v-model="q" placeholder="Search..."
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          )
          span.icon.is-small.is-left
            fontawesome(icon="search")
      .menu
        Treeview(:data="data" :handler="handler")
  b-modal.quiz-modal(:active.sync="isQuizActive" @close="endQuiz")
    .card
      .card-content
        iframe(ref="quizIframe" frameborder="0")
      .buttons-area.buttons(v-if="currentQuizIndex < 0 && quizKeys.length > 0")
        button.button.is-success(@click="nextQuizItem") Start quiz
      .buttons-area.buttons(v-else-if="!key")
        button.button.is-warning(@click="endQuiz") End quiz
      .buttons-area.buttons(v-else-if="!isQuizShownAnswer")
        button.button.is-warning(@click="isQuizShownAnswer = true") Show answer
      .buttons-area(v-else-if="$mq === 'sm'" style="display: flex; flex-direction: column;")
        .buttons
          button.button.is-success(@click="markRight") Right
          button.button.is-danger(@click="markWrong") Wrong
          button.button.is-warning(@click="markRepeat") Repeat
        .buttons
          button.button.is-warning(@click="isQuizShownAnswer = false") Hide answer
          a.button.is-info(:href="getEditTo(key)" target="_blank") Edit
      .buttons-area.buttons(v-else)
        button.button.is-warning(@click="isQuizShownAnswer = false") Hide answer
        button.button.is-success(@click="markRight") Right
        button.button.is-danger(@click="markWrong") Wrong
        button.button.is-warning(@click="markRepeat") Repeat
        a.button.is-info(:href="getEditTo(key)" target="_blank") Edit
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import axios, { AxiosInstance } from 'axios'
import hbs from 'handlebars'
import Treeview from '@/components/Treeview.vue'

import { Matter } from '../make-html/matter'
import MakeHtml from '../make-html'
import { deepMerge } from '../utils'

@Component<Quiz>({
  components: {
    Treeview
  },
  data () {
    return {
      handler: {
        quiz: (deck: string) => {
          this.activeDeck = deck
        }
      }
    }
  }
})
export default class Quiz extends Vue {
  data = []
  q = ''

  isQuizActive = false
  activeDeck = ''
  isQuizShownAnswer = false
  quizKeys: string[] = []
  currentQuizIndex = -1
  currentQuizMarkdown = ''

  ctx = {} as any

  get key () {
    return this.quizKeys[this.currentQuizIndex]
  }

  get lessonName () {
    return this.$route.params.name
  }

  mounted () {
    this.load()
  }

  getQuizIframeDocument () {
    const iframe = this.$refs.quizIframe as HTMLIFrameElement
    if (iframe) {
      return iframe.contentDocument
    }

    return null
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  async load (silent?: boolean) {
    const api = await this.getApi(silent)
    const data = (await api.post('/api/quiz/stat', { q: this.q, lesson: this.lessonName })).data
    this.$set(this, 'data', data)
  }

  @Watch('$route.query.q')
  async loadSpinning () {
    return this.load()
  }

  onSearch () {
    this.$router.push({
      path: `/quiz/${this.lessonName}`,
      query: {
        q: this.q
      }
    })
  }

  @Watch('activeDeck')
  async onActiveDeckChange () {
    if (this.activeDeck) {
      const api = await this.getApi()
      const keys: string[] = (await api.post('/api/quiz/', {
        q: this.q,
        lesson: this.lessonName,
        deck: this.activeDeck
      })).data.keys
      let next = {
        hour: 0,
        day: 0
      }

      this.$set(this, 'quizKeys', keys)

      if (!(keys.length > 0)) {
        const [hour, day] = await Promise.all([
          api.post('/api/quiz/', {
            q: `${this.q} nextReview<+1h`,
            lesson: this.lessonName,
            deck: this.activeDeck
          }),
          api.post('/api/quiz/', {
            q: `${this.q} nextReview<+1d`,
            lesson: this.lessonName,
            deck: this.activeDeck
          })
        ])
        next = {
          hour: hour.data.keys.length,
          day: day.data.keys.length
        }
      }

      this.currentQuizIndex = -1
      this.isQuizShownAnswer = false
      this.isQuizActive = true

      this.$nextTick(() => {
        const d = this.getQuizIframeDocument()
        if (d) {
          const makeHtml = new MakeHtml()
          if (keys.length > 0) {
            makeHtml.render(d.body, `${keys.length.toLocaleString()} entries to go. :muscle:`)
          } else {
            makeHtml.render(
              d.body,
              `Pending next hour: ${next.hour.toLocaleString()}. :clock1:\n\n` +
              `Pending next day: ${next.day.toLocaleString()}. ${next.day ? ':sweat_smile:' : ''}`
            )
          }
        }
      })
    }
  }

  @Watch('isQuizShownAnswer')
  async onQuizToogleShownAnswer () {
    const d = this.getQuizIframeDocument()
    if (!d) {
      return
    }

    const makeHtml = new MakeHtml(this.key)

    if (this.key) {
      if (!this.currentQuizMarkdown) {
        const api = await this.getApi()
        const r = await api.get('/api/edit/', {
          params: {
            key: this.key
          }
        })

        const matter = new Matter()
        const { header, content } = matter.parse(r.data.markdown || '')
        this.ctx[this.key] = r.data

        const ref = deepMerge({}, deepMerge(header.ref || {}, r.data.ref))
        await this.onCtxChange(ref)

        this.currentQuizMarkdown = content
      }

      const [front, back = '', ...others] = this.currentQuizMarkdown.split('\n===\n')
      if (!this.isQuizShownAnswer) {
        makeHtml.patch(d.body, hbs.compile([front, ...others].join('\n'))(this.ctx))
      } else {
        makeHtml.patch(d.body, hbs.compile([back, ...others].join('\n'))(this.ctx))
      }
    } else {
      makeHtml.render(d.body, 'Congrats :smile: You have finished your quiz!')
    }

    d.querySelectorAll('script:not([data-loaded])').forEach((el) => {
      el.setAttribute('data-loaded', '1')

      const el1 = el.cloneNode(true) as HTMLScriptElement
      el.replaceWith(el1)
    })
  }

  nextQuizItem () {
    this.currentQuizMarkdown = ''
    this.currentQuizIndex++

    if (this.isQuizShownAnswer) {
      this.isQuizShownAnswer = false
    } else {
      this.isQuizShownAnswer = true
      this.$nextTick(() => {
        this.isQuizShownAnswer = false
      })
    }
  }

  async markRight () {
    const api = await this.getApi()
    await api.patch('/api/quiz/right', {}, {
      params: {
        key: this.key
      }
    })

    this.nextQuizItem()
  }

  async markWrong () {
    const api = await this.getApi()
    await api.patch('/api/quiz/wrong', {}, {
      params: {
        key: this.key
      }
    })

    this.nextQuizItem()
  }

  async markRepeat () {
    const api = await this.getApi()
    await api.patch('/api/quiz/repeat', {}, {
      params: {
        key: this.key
      }
    })

    this.nextQuizItem()
  }

  getEditTo (key: string) {
    return this.$router.resolve({
      path: '/edit',
      query: {
        key
      }
    }).href
  }

  endQuiz () {
    this.isQuizActive = false
    this.activeDeck = ''
    this.load()
  }

  async onCtxChange (ctx: Record<string, any>) {
    await Promise.all(Object.entries(ctx).map(async ([key, data]) => {
      if (typeof data !== 'undefined' && !this.ctx[key]) {
        if (!data) {
          const api = await this.getApi(true)
          const r = await api.get('/api/edit/', {
            params: {
              key
            }
          })
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
}
</script>

<style lang="scss">
.quiz-modal {
  .modal-content {
    height: calc(100vh - 160px);

    > .card {
      height: calc(100% - 5px);
    }
  }

  @media screen and (min-width: 769px), print {
    .modal-content {
      height: calc(100vh - 40px);
    }
  }

  .card-content {
    height: calc(100% - 60px);

    > iframe {
      height: 100%;
      width: 90vw;
      border-bottom: 1px solid #ccc;
    }
  }

  @media screen and (max-width: 500px) {
    .card-content {
      height: calc(100% - 100px);
    }

    .buttons {
      padding-bottom: 0 !important;
      margin-bottom: 0;
    }

    .buttons-area {
      height: 100px;
    }
  }

  .buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    padding-bottom: 20px;
  }
}
</style>
