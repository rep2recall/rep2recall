import { api, magic } from '@/assets/api'
import { Component, Vue } from 'vue-property-decorator'

@Component<Front>({
  created() {
    if (!magic) {
      this.$router.push('/quiz')
    }
  }
})
export default class Front extends Vue {
  email = ''

  doLogin() {
    if (magic) {
      magic.auth
        .loginWithMagicLink({ email: this.email })
        .then((token) => {
          if (!token) {
            throw new Error()
          }
          api.defaults.headers.Authorization = `Bearer ${token}`
          this.$router.push('/quiz')
        })
        .catch(() => {
          delete api.defaults.headers.Authorization
        })
    }
  }
}
