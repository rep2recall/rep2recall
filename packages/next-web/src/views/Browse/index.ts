import { api } from '@/assets/api'
import ejs from 'ejs'
import yaml from 'js-yaml'
import { Component, Vue } from 'vue-property-decorator'

@Component<Browse>({
  watch: {
    dataOptions: {
      deep: true,
      handler () {
        this.reload()
      }
    }
  },
  created () {
    this.reload()
  }
})
export default class Browse extends Vue {
  itemSelected = []
  columns = [
    {
      text: 'Key',
      value: 'key',
      width: 200
    },
    {
      text: 'Front',
      value: 'front',
      sortable: false
    },
    {
      text: 'Back',
      value: 'front',
      sortable: false
    },
    {
      text: 'Attributes',
      value: 'attr',
      sortable: false
    },
    {
      text: 'Last updated',
      value: 'updatedAt',
      width: 200
    },
    {
      value: 'action',
      width: 80
    }
  ]

  tableData: {
    key: string;
    front: string;
    back: string;
  }[] = []

  quizData: Record<string, {
    front?: string;
    back?: string;
    attr?: Record<string, string>;
    data?: Record<string, unknown>;
  }> = {}

  isLoading = false
  dataOptions = {
    sortBy: ['updatedAt'],
    sortDesc: [true],
    page: 1,
    itemsPerPage: 5
  }

  count = 1

  batchActions = [
    { text: 'Edit', callback: () => this.doBatchEdit() },
    {
      text: 'Delete',
      callback: () => this.doBatchDelete()
    }
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

  yamlDump (o: unknown) {
    return yaml.safeDump(o)
  }

  getData (key: string, field: 'front' | 'back' | 'attr') {
    return (this.quizData[key] || {})[field]
  }

  doBatchEdit () {
    console.log('Batch edit')
  }

  doBatchDelete () {
    console.log('Batch delete')
  }

  doEdit (it: unknown) {
    console.log(it)
  }

  doDelete (it: unknown) {
    console.log(it)
  }

  async reload () {
    this.isLoading = true

    const { data } = await api.post<{
      result: {
        key: string;
        front?: string;
        back?: string;
        attr?: {
          key: string;
          value: string;
        }[];
        data?: Record<string, unknown>;
      }[];
      count: number;
    }>('/api/note/q', {
      select: ['key', 'front', 'back', 'attr', 'data'],
      q: this.$accessor.q,
      offset: (this.dataOptions.page - 1) * this.dataOptions.itemsPerPage,
      limit: this.dataOptions.itemsPerPage,
      sortBy: this.dataOptions.sortBy[0],
      desc: this.dataOptions.sortDesc[0]
    })

    this.tableData = data.result.map((d) => {
      this.$set(this.quizData, d.key, this.quizData[d.key] || {})

      const attr = d.attr ? d.attr.reduce((prev, it) => ({
        ...prev,
        [it.key]: it.value
      }), {} as Record<string, string>) : {}

      const ctx = {
        ...this.ejsContext,
        attr,
        data: d.data
      }

      this.$set(this.quizData[d.key], 'attr', attr)
      this.$set(this.quizData[d.key], 'data', d.data)

      Promise.all([
        ejs.render(d.front || '', ctx, { async: true }).then((r) => {
          this.$set(this.quizData[d.key], 'front', r)
        }),
        ejs.render(d.back || '', ctx, { async: true }).then((r) => {
          this.$set(this.quizData[d.key], 'back', r)
        })
      ])

      return {
        key: d.key,
        front: d.front || '',
        back: d.back || ''
      }
    })

    this.isLoading = false
  }
}
