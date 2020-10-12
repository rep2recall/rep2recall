import { Component, Vue } from 'vue-property-decorator'

@Component<App>({
  created () {
    this.q = this.$route.query.q as string
  }
})
export default class App extends Vue {
  isDrawer = false
  q = ''

  doSearch () {
    console.log(this.q)
  }
}
