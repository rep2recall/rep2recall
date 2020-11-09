import { api } from '@/assets/api'
import { Component, Vue } from 'vue-property-decorator'

type ITreeview<T> = {
  id: string;
  name: string;
  children?: ITreeview<T>[];
} & T

interface IStatus {
  new: boolean;
  due: boolean;
  leech: boolean;
  graduated: boolean;
}

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
    }
  },
  created () {
    this.loadState()
  }
})
export default class Quiz extends Vue {
  q = ''

  itemSelected: string[] = []
  itemOpened: string[] = []

  status: IStatus = {
    new: true,
    due: true,
    leech: true,
    graduated: false
  }

  quizData: IQuizData[] = []

  quizIds: string[] = []

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
      children: recurseTreeview(this.quizData, [])
    }]
  }

  async startQuiz () {
    try {
      const { data } = await api.post<{
        ids: string[];
      }>('/api/quiz/q', {
        decks: this.itemSelected,
        q: this.q,
        status: this.status
      })

      this.quizIds = data.ids
      alert('Starting quiz')
    } catch (e) {
      console.error(e)
    }
  }

  async exportQuiz () {
    try {
      const { data } = await api.post<{
        ids: string[];
      }>('/api/quiz/q', {
        decks: this.itemSelected,
        q: this.q,
        status: this.status
      })

      this.quizIds = data.ids
      alert('Exporting quiz')
    } catch (e) {
      console.error(e)
    }
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
        q: this.q,
        name: this.saveName,
        selected: this.itemSelected,
        opened: this.itemOpened,
        status: this.status
      })

      this.$router.push({
        path: '/quiz',
        query: {
          id: data.id
        }
      })

      this.$accessor.UPDATE_TAGS({
        id: data.id,
        name: this.saveName,
        q: this.q,
        status: this.status,
        canDelete: true,
        itemSelected: this.itemSelected,
        itemOpened: this.itemOpened
      })

      this.isSaveNameDialog = false
    }
  }

  async doSaveUpdate () {
    await api.put('/api/preset', {
      q: this.q,
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
      q: this.q,
      status: this.status,
      canDelete: true,
      itemSelected: this.itemSelected,
      itemOpened: this.itemOpened
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
          id: this.$route.query.id
        }
      })

      this.q = data.q
      this.saveName = data.name
      this.itemSelected = data.selected
      this.itemOpened = data.opened
      this.status = data.status

      this.doFilter()
    } catch (e) {
      console.error(e)

      this.itemSelected = ['Level 11-20\x1fLevel 11']
      this.itemOpened = ['', 'Level 11-20', 'Level 11-20\x1fLevel 12']
      this.quizData = [
        {
          deck: ['Level  1-10', 'Level  1', 'JE'],
          new: Math.floor(Math.random() * 10000),
          due: Math.floor(Math.random() * 10000),
          leech: Math.floor(Math.random() * 10000)
        },
        {
          deck: ['Level 11-20', 'Level 11', 'JE'],
          new: Math.floor(Math.random() * 10000),
          due: Math.floor(Math.random() * 10000),
          leech: Math.floor(Math.random() * 10000)
        },
        {
          deck: ['Level 11-20', 'Level 12', 'JE'],
          new: Math.floor(Math.random() * 10000),
          due: Math.floor(Math.random() * 10000),
          leech: Math.floor(Math.random() * 10000)
        },
        {
          deck: ['Level 11-20', 'Level 12', 'EJ'],
          new: Math.floor(Math.random() * 10000),
          due: Math.floor(Math.random() * 10000),
          leech: Math.floor(Math.random() * 10000)
        }
      ]
    }
  }

  async saveState () {
    try {
      await api.put('/api/preset/default', {
        q: this.q,
        name: this.saveName,
        selected: this.itemSelected,
        opened: this.itemOpened,
        status: this.status
      })
    } catch (e) {
      console.error(e)
    }
  }

  _doFilterTimeout: number | null = null

  doFilter () {
    if (typeof this._doFilterTimeout === 'number') {
      clearTimeout(this._doFilterTimeout)
    }

    this._doFilterTimeout = window.setTimeout(async () => {
      try {
        const { data } = await api.post<{
          data: IQuizData[];
        }>('/api/quiz/treeview', {
          q: this.q,
          status: this.status
        })

        this.quizData = data.data
      } catch (e) {
        console.error(e)
      }
    }, 500)
  }
}
