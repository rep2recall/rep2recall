import { Component, Vue } from 'vue-property-decorator'

type Treeview<T> = {
  id: string;
  name: string;
  children?: Treeview<T>[];
} & T

@Component
export default class Quiz extends Vue {
  itemSelected: string[] = ['Level 11-20\x1fLevel 11']
  itemOpened: string[] = ['', 'Level 11-20', 'Level 11-20\x1fLevel 12']

  quizData: {
    deck: string[];
    new: number;
    due: number;
    leech: number;
  }[] = [
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

  get treeview (): Treeview<{
    new: number;
    due: number;
    leech: number;
  }>[] {
    const recurseTreeview = (
      c: this['quizData'],
      parent: string[]
    ): this['treeview'] => {
      const subset = c.filter((c0) => {
        const isChild: boolean[] = []
        parent.map((p, i) => {
          isChild.push(c0.deck[i] === p)
        })

        return isChild.length > 0 ? isChild.every((t) => t) : true
      })

      const sMap = new Map<string, this['quizData']>()

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

  startQuiz () {
    console.log(this.itemSelected, this.itemOpened)
  }
}
