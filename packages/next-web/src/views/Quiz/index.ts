import { api } from '@/assets/api'
import { IStatus } from '@/store'
import ejs from 'ejs'
import { Component, Vue } from 'vue-property-decorator'

type ITreeview<T> = {
  id: string;
  name: string;
  children?: ITreeview<T>[];
} & T

interface IQuizData {
  deck: string[];
  new: number;
  due: number;
  leech: number;
}

@Component<Quiz>({
  watch: {
    itemSelected: {
      deep: true,
      handler () {
        this.saveState()
      }
    },
    itemOpened: {
      deep: true,
      handler () {
        this.saveState()
      }
    },
    status: {
      deep: true,
      handler () {
        this.saveState()
      }
    },
    '$route.query.id' () {
      this.loadState()
    },
    '$store.state.q' () {
      this.doFilter()
    }
  },
  created () {
    this.loadState()
  }
})
export default class Quiz extends Vue {
  itemSelected = ['']
  itemOpened = ['']

  status: IStatus = {
    new: true,
    due: true,
    leech: true,
    graduated: false
  }

  treeviewData: IQuizData[] = []

  quizData: Record<string, {
    front?: string;
    back?: string;
    attr?: Record<string, string>;
    data?: Record<string, unknown>;
  }> = {}

  quizIds: string[] = [];
  quizIndex = -1
  isQuizDialog = false
  isQuizAnswerShown = false

  isSaveNameDialog = false
  isSaveConfirmDialog = false
  saveName = ''

  quizActions = [
    { text: 'Start quiz', callback: () => this.startQuiz() },
    {
      text: 'Save',
      callback: () => this.openSaveNameDialog()
    },
    { text: 'Export', callback: () => this.exportQuiz(), disabled: true }
  ]

  ejsContext = {
    $: async (quizId: string, field: 'front' | 'back' | 'data' | 'attr') => {
      this.$set(this.quizData, quizId, this.quizData[quizId] || {})

      if (typeof this.quizData[quizId][field] !== 'undefined') {
        return this.quizData[quizId][field]
      }

      try {
        await this.cacheContent(quizId, [field])
      } catch (e) {
        console.error(e)
      }

      return this.quizData[quizId][field]
    },
    $$: async (quizId: string, attr: string) => {
      if (typeof (this.quizData[quizId]?.attr || {})[attr] !== 'undefined') {
        return (this.quizData[quizId].attr || {})[attr]
      }

      const { data } = await api.get<{
        result?: string;
      }>('/api/note/attr', {
        params: {
          key: quizId,
          attr
        }
      })

      this.$set(this.quizData, quizId, this.quizData[quizId] || {})
      this.$set(this.quizData[quizId], 'attr', this.quizData[quizId].attr || {})
      this.$set(this.quizData[quizId].attr || {}, attr, data.result)

      return data.result
    }
  }

  get treeview (): ITreeview<{
    new: number;
    due: number;
    leech: number;
  }>[] {
    const recurseTreeview = (
      c: IQuizData[],
      parent: string[]
    ): this['treeview'] => {
      const subset = c.filter((c0) => {
        const isChild: boolean[] = []
        parent.map((p, i) => {
          isChild.push(c0.deck[i] === p)
        })

        return isChild.length > 0 ? isChild.every((t) => t) : true
      })

      const sMap = new Map<string, IQuizData[]>()

      if (subset.length === 0) {
        sMap.set(parent.join('\x1f'), [{
          deck: parent,
          new: 0,
          due: 0,
          leech: 0
        }])
      } else {
        for (const s of subset) {
          const id = s.deck.slice(0, parent.length + 1).join('\x1f')

          const prev = sMap.get(id)
          if (prev) {
            prev.push(s)
            sMap.set(id, prev)
          } else {
            sMap.set(id, [s])
          }
        }
      }

      return Array.from(sMap).map(([k, vs]) => {
        return {
          id: k,
          name: vs[0].deck[parent.length],
          new: vs.reduce((prev, v) => prev + v.new, 0),
          due: vs.reduce((prev, v) => prev + v.due, 0),
          leech: vs.reduce((prev, v) => prev + v.leech, 0),
          children: vs[0].deck.length > parent.length + 1
            ? recurseTreeview(vs, vs[0].deck.slice(0, parent.length + 1))
            : undefined
        }
      })
    }

    return [{
      id: '',
      name: 'All quizzes',
      new: 0,
      due: 0,
      leech: 0,
      children: this.treeviewData.length
        ? recurseTreeview(this.treeviewData, [])
        : undefined
    }]
  }

  get quizCurrent () {
    const r = this.quizIds[this.quizIndex]

    if (!r) {
      return null
    }

    return r
  }

  get iframeContent () {
    if (!this.quizCurrent || !this.quizData[this.quizCurrent]) {
      return ''
    }

    return (this.isQuizAnswerShown
      ? this.quizData[this.quizCurrent].back
      : this.quizData[this.quizCurrent].front) || ''
  }

  startQuiz () {
    this.quizIds.slice(0, 3).map((id) => this.cacheContent(id))
    this.quizIndex = -1
    this.isQuizDialog = true
  }

  nextQuiz () {
    this.quizIndex++
    this.quizIds.slice(this.quizIndex, this.quizIndex + 3)
      .map((id) => this.cacheContent(id))
  }

  async markQuiz (as: 'right' | 'wrong' | 'repeat') {
    if (!this.quizCurrent) {
      return
    }

    await api.patch('/api/quiz/mark', undefined, {
      params: {
        key: this.quizCurrent,
        as
      }
    })

    this.nextQuiz()
  }

  async cacheContent (quizId?: string, fields = ['front', 'back', 'attr', 'data']) {
    if (!quizId) {
      return
    }

    this.$set(this.quizData, quizId, this.quizData[quizId] || {})

    const fieldSet = new Set(fields)
    fields.forEach((f) => {
      if (f === 'attr') {
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (this.quizData[quizId] as any)[f] !== 'undefined') {
        fieldSet.delete(f)
      }
    })

    const { data } = await api.get<{
      front?: string;
      back?: string;
      attr?: {
        key: string;
        value: string;
      }[];
      data?: Record<string, unknown>;
    }>('/api/note', {
      params: {
        key: quizId,
        select: Array.from(fieldSet).join(',')
      }
    })

    const attr = data.attr ? data.attr.reduce((prev, it) => ({
      ...prev,
      [it.key]: it.value
    }), {} as Record<string, string>) : {}

    const ctx = {
      ...this.ejsContext,
      attr,
      data: data.data
    }

    this.$set(this.quizData[quizId], 'attr', attr)
    this.$set(this.quizData[quizId], 'data', data.data)

    await Promise.all([
      ejs.render(data.front || '', ctx, { async: true }).then((r) => {
        this.$set(this.quizData[quizId], 'front', r)
      }),
      ejs.render(data.back || '', ctx, { async: true }).then((r) => {
        this.$set(this.quizData[quizId], 'back', r)
      })
    ])
  }

  async exportQuiz () {
    alert('Exporting quiz')
  }

  openSaveNameDialog () {
    this.saveName = new Date().toLocaleString()
    this.isSaveNameDialog = true
  }

  async doSaveConfirm () {
    if (this.$accessor.hasTag(this.saveName)) {
      this.isSaveConfirmDialog = true
    } else {
      const { data } = await api.put<{
        id: string;
      }>('/api/preset', {
        q: this.$accessor.q,
        name: this.saveName,
        selected: this.itemSelected,
        opened: this.itemOpened,
        status: this.status
      })

      this.$accessor.UPDATE_TAGS({
        id: data.id,
        q: this.$accessor.q,
        name: this.saveName,
        selected: this.itemSelected,
        opened: this.itemOpened,
        status: this.status,
        canDelete: true
      })

      this.$router.push({
        path: '/quiz',
        query: {
          id: data.id
        }
      })

      this.isSaveNameDialog = false
    }
  }

  async doSaveUpdate () {
    await api.patch('/api/preset', {
      q: this.$accessor.q,
      selected: this.itemSelected,
      opened: this.itemOpened,
      status: this.status
    }, {
      params: {
        id: this.$route.query.id
      }
    })

    this.$accessor.UPDATE_TAGS({
      id: this.$route.query.id as string,
      name: this.saveName,
      q: this.$accessor.q,
      status: this.status,
      canDelete: true,
      selected: this.itemSelected,
      opened: this.itemOpened
    })

    this.isSaveNameDialog = false
    this.isSaveConfirmDialog = false
  }

  async loadState () {
    try {
      const { data } = await api.get<{
        q: string;
        name: string;
        selected: string[];
        opened: string[];
        status: IStatus;
      }>('/api/preset', {
        params: {
          id: this.$route.query.id,
          select: 'q,name,selected,opened,status'
        }
      })

      this.$accessor.UPDATE_Q(data.q)
      this.saveName = data.name
      this.itemSelected = data.selected
      this.itemOpened = data.opened
      this.status = data.status

      this.doFilter()
    } catch (_) {}
  }

  async saveState () {
    /**
     * Do not await
     */
    api.patch('/api/preset', {
      q: this.$accessor.q,
      selected: this.itemSelected,
      opened: this.itemOpened,
      status: this.status
    }, {
      params: {
        id: this.$route.query.id
      }
    })

    const { data } = await api.post<{
      result: string[];
    }>('/api/quiz', {
      decks: this.itemSelected,
      q: this.$accessor.q,
      status: this.status
    })

    this.quizIds = data.result
  }

  _doFilterTimeout: number | null = null

  doFilter () {
    if (typeof this._doFilterTimeout === 'number') {
      clearTimeout(this._doFilterTimeout)
    }

    this._doFilterTimeout = window.setTimeout(async () => {
      const { data } = await api.post<{
        result: IQuizData[];
      }>('/api/quiz/treeview', {
        q: this.$accessor.q,
        status: this.status
      })

      this.treeviewData = data.result
      this.saveState()
    }, 500)
  }
}
