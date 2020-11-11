import { api } from '@/assets/api'
import { ITag } from '@/store'
import { Component, Vue } from 'vue-property-decorator'

@Component<App>({
  created () {
    this.q = this.$accessor.q
    this.loadTags()
  }
})
export default class App extends Vue {
  isDrawer = false
  isTagOpen = true
  q = ''

  isEdited = false

  doSearch () {
    this.$accessor.UPDATE_Q(this.q)
  }

  doLoad (id: string) {
    this.$router.push({
      path: '/quiz',
      query: {
        id
      }
    })
  }

  doDelete (id: string) {
    this.$accessor.REMOVE_TAGS(id)
  }

  async loadTags () {
    try {
      await api.get('/api/preset', {
        params: {
          select: 'id'
        }
      })
    } catch (e) {
      await api.put('/api/preset', {
        id: '',
        q: this.q,
        name: 'Default',
        selected: [''],
        opened: [''],
        status: {
          new: true,
          due: true,
          leech: true,
          graduated: false
        }
      })
    }

    try {
      const { data } = await api.get<{
        result: ITag[];
      }>('/api/preset/all')

      console.log(data)

      data.result.map((t) => {
        this.$accessor.UPDATE_TAGS({
          ...t,
          canDelete: !!t.id
        })
      })
    } catch (e) {
      console.error(e)
    }
  }
}
