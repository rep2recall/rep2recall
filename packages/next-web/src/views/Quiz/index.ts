import { Component, Vue } from 'vue-property-decorator'

type Treeview<T> = {
  id: string;
  name: string;
  children?: Treeview<T>[];
} & T

@Component
export default class Quiz extends Vue {
  itemSelected = [2, 3]
  itemOpened = []

  quizData: {
    deck: string[];
    new: number;
    due: number;
    leech: number;
  }[] = [
    {
      deck: ['Level  1-10', 'Level  1', 'JE'],
      new: Math.floor(Math.random() * 100),
      due: Math.floor(Math.random() * 100),
      leech: Math.floor(Math.random() * 100)
    },
    {
      deck: ['Level 11-20', 'Level 11', 'JE'],
      new: Math.floor(Math.random() * 100),
      due: Math.floor(Math.random() * 100),
      leech: Math.floor(Math.random() * 100)
    },
    {
      deck: ['Level 11-20', 'Level 12', 'JE'],
      new: Math.floor(Math.random() * 100),
      due: Math.floor(Math.random() * 100),
      leech: Math.floor(Math.random() * 100)
    },
    {
      deck: ['Level 11-20', 'Level 12', 'EJ'],
      new: Math.floor(Math.random() * 100),
      due: Math.floor(Math.random() * 100),
      leech: Math.floor(Math.random() * 100)
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
      let subset = c.filter((c0) => {
        const isChild: boolean[] = []
        parent.map((p, i) => {
          isChild.push(c0.deck[i] === p)
        })

        return isChild.length > 0 ? isChild.every((t) => t) : true
      })

      if (subset.length === 0) {
        subset = [{
          deck: parent,
          new: 0,
          due: 0,
          leech: 0
        }]
      } else {
        const sMap = new Map<string, this['quizData'][0]>()
        for (const s of subset) {
          const id = s.deck.join('\x1f')

          const prev = sMap.get(id) || {
            deck: s.deck,
            new: 0,
            due: 0,
            leech: 0
          }
          prev.new += s.new
          prev.due += s.new
          prev.leech += s.leech

          sMap.set(id, prev)
        }
        subset = Array.from(sMap)
          .sort(([k1], [k2]) => k1.localeCompare(k2))
          .map(([, v]) => v)
      }

      return subset.map((c0) => {
        return {
          id: c0.deck.join('\x1f'),
          name: c0.deck[c0.deck.length - 1],
          new: c0.new,
          due: c0.due,
          leech: c0.leech,
          children: recurseTreeview(subset, c0.deck.slice(0, parent.length + 1))
        }
      })
    }

    const r = recurseTreeview(this.quizData, [])
    console.log(r)
    return r
  }

  startQuiz () {
    console.log(this.itemSelected, this.itemOpened)
  }
}
