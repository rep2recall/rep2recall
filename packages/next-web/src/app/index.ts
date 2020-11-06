import { api } from '@/assets/api'
import { ITag } from '@/store'
import { Component, Vue } from 'vue-property-decorator'

@Component<App>({
  created () {
    this.q = this.$route.query.q as string
    this.loadTags()
  }
})
export default class App extends Vue {
  isDrawer = false
  isTagOpen = true
  q = ''

  isEdited = false

  doSearch () {
    const isSearchablePath = ['/', '/edit', '/quiz'].includes('path')

    if (!isSearchablePath || this.q !== this.$route.query.q) {
      this.$router.push({
        path: isSearchablePath ? this.$route.path : '/',
        query: {
          q: this.q
        }
      })
    }
  }

  doLoad (id: string) {
    this.$router.push({
      path: '/quiz',
      query: {
        tag: id
      }
    })
  }

  doDelete (id: string) {
    this.$accessor.REMOVE_TAGS(id)
  }

  async loadTags () {
    try {
      const { data } = await api.get<{
        tags: ITag[];
      }>('/api/tag/q')

      data.tags.map((t) => {
        this.$accessor.ADD_TAGS({
          ...t,
          canDelete: false
        })
      })
    } catch (e) {
      console.error(e)
    }
  }
}
