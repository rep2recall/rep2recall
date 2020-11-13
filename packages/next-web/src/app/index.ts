import { api } from '@/assets/api'
import { ITag, IUser } from '@/store'
import { Component, Vue } from 'vue-property-decorator'

@Component<App>({
  created () {
    this.q = this.$accessor.q
    Promise.all([
      this.loadUser(),
      this.loadPreset()
    ])
  }
})
export default class App extends Vue {
  isDrawer = false
  isTagOpen = true
  q = ''

  isEdited = false

  get user () {
    return this.$accessor.user
  }

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

  async loadUser () {
    const { data } = await api.get<IUser>('/api/user', {
      params: {
        select: 'name,email,image,apiKey'
      }
    })

    this.$accessor.UPDATE_USER(data)
  }

  async loadPreset () {
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

    const { data } = await api.get<{
      result: ITag[];
    }>('/api/preset/all')

    data.result.map((t) => {
      this.$accessor.UPDATE_TAGS({
        ...t,
        canDelete: !!t.id
      })
    })
  }
}
