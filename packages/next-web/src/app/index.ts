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
  tags = Array(20).fill(null).map((_, i) => (Math.random() * (i + 1)).toString(36).substr(2))

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
    this.tags = this.tags.filter((t) => t !== id)
  }
}
