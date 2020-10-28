import { Component, Vue } from 'vue-property-decorator'

@Component<App>({
  created () {
    this.q = this.$route.query.q as string
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

  doDelete (id: string) {
    this.$store.commit('REMOVE_TAGS', id)
  }
}
