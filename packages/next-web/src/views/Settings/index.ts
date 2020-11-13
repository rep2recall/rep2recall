import { api } from '@/assets/api'
import { Component, Vue } from 'vue-property-decorator'

@Component<Settings>({
  async created () {
    if (location.origin.includes('://localhost')) {
      const { data } = await api.get<{
        baseURL: string;
      }>('/api/config')

      this.baseURL = data.baseURL
    }
  }
})
export default class Settings extends Vue {
  baseURL = location.origin

  get user () {
    return this.$accessor.user
  }

  async newApiKey () {
    const { data } = await api.patch<{
      result: string;
    }>('/api/user/apiKey')

    this.$accessor.UPDATE_USER({
      ...this.$accessor.user,
      apiKey: data.result
    })
  }

  async deleteUser () {
    await api.delete('/api/user')
    this.$router.push('/')
  }
}
