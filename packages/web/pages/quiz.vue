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
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import axios from 'axios'
import hbs from 'handlebars'
import Treeview from '@/components/Treeview.vue'
import { Matter } from '@/assets/make-html/matter'
import MakeHtml from '@/assets/make-html'
import { deepMerge, normalizeArray } from '@/assets/util'

@Component<Quiz>({
  layout: 'dashboard',
  components: {
    Treeview,
  },
  data() {
    return {
      handler: {
        quiz: (deck: string) => {
          this.activeDeck = deck
        },
      },
    }
  },
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

  get key() {
    return (this.quizKeys || [])[this.currentQuizIndex]
  }

  get lessonId() {
    return this.$route.query.id
  }

  mounted() {
    this.q = normalizeArray(this.$route.query.q) || ''
    this.load()
  }

  getQuizIframeDocument() {
    const iframe = this.$refs.quizIframe as HTMLIFrameElement
    if (iframe) {
      return iframe.contentDocument
    }

    return null
  }

  async load() {
    const data = await this.$axios.$post('/api/quiz/stat', {
      q: this.q,
      lesson: this.lessonId,
    })
    this.$set(this, 'data', data)
  }

  @Watch('$route.query.q')
  loadSpinning() {
    this.q = normalizeArray(this.$route.query.q) || ''
    return this.load()
  }

  onSearch() {
    this.$router.push({
      path: '/quiz',
      query: {
        q: this.q,
        id: this.lessonId,
      },
    })
  }

  @Watch('activeDeck')
  async onActiveDeckChange() {
    if (this.activeDeck) {
      const keys: string[] =
        (
          await this.$axios.$post('/api/quiz/', {
            q: this.q,
            lesson: this.lessonId,
            deck: this.activeDeck,
          })
        ).keys || []
      let next = {
        hour: 0,
        day: 0,
      }

      this.$set(this, 'quizKeys', keys)

      if (!(keys.length > 0)) {
        const [hour, day] = await Promise.all([
          this.$axios.$post('/api/quiz/', {
            q: `${this.q} nextReview<+1h`,
            lesson: this.lessonId,
            deck: this.activeDeck,
          }),
          this.$axios.$post('/api/quiz/', {
            q: `${this.q} nextReview<+1d`,
            lesson: this.lessonId,
            deck: this.activeDeck,
          }),
        ])
        next = {
          hour: hour.keys.length,
          day: day.keys.length,
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
            makeHtml.render(
              d.body,
              `${keys.length.toLocaleString()} entries to go. :muscle:`
            )
          } else {
            makeHtml.render(
              d.body,
              `Pending next hour: ${next.hour.toLocaleString()}. :clock1:\n\n` +
                `Pending next day: ${next.day.toLocaleString()}. ${
                  next.day ? ':sweat_smile:' : ''
                }`
            )
          }
        }
      })
    }
  }

  @Watch('isQuizShownAnswer')
  async onQuizToogleShownAnswer() {
    const d = this.getQuizIframeDocument()
    if (!d) {
      return
    }

    const makeHtml = new MakeHtml(this.key)

    if (this.key) {
      if (!this.currentQuizMarkdown) {
        const r = await this.$axios.$get('/api/edit/', {
          params: {
            key: this.key,
          },
        })

        const matter = new Matter()
        const { header, content } = matter.parse(r.markdown || '')
        this.ctx[this.key] = r

        const ref = deepMerge(r.ref, header.ref)
        await this.onCtxChange(ref)

        this.currentQuizMarkdown = content
      }

      const [front, back = '', ...others] = this.currentQuizMarkdown.split(
        '\n===\n'
      )
      if (!this.isQuizShownAnswer) {
        makeHtml.patch(
          d.body,
          hbs.compile([front, ...others].join('\n'))(this.ctx)
        )
      } else {
        makeHtml.patch(
          d.body,
          hbs.compile([back, ...others].join('\n'))(this.ctx)
        )
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

  nextQuizItem() {
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

  async markRight() {
    await this.$axios.$patch(
      '/api/quiz/right',
      {},
      {
        params: {
          key: this.key,
        },
      }
    )

    this.nextQuizItem()
  }

  async markWrong() {
    await this.$axios.$patch(
      '/api/quiz/wrong',
      {},
      {
        params: {
          key: this.key,
        },
      }
    )

    this.nextQuizItem()
  }

  async markRepeat() {
    await this.$axios.$patch(
      '/api/quiz/repeat',
      {},
      {
        params: {
          key: this.key,
        },
      }
    )

    this.nextQuizItem()
  }

  getEditTo(key: string) {
    return this.$router.resolve({
      path: '/edit',
      query: {
        key,
      },
    }).href
  }

  endQuiz() {
    this.isQuizActive = false
    this.activeDeck = ''
    this.load()
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
                key,
              },
            })
            this.ctx[key] = r
            this.ctx[key].markdown = new Matter().parse(
              r.markdown || ''
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
