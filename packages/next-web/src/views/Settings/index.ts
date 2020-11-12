import { api } from '@/assets/api'
import { Component, Vue } from 'vue-property-decorator'

@Component
export default class Settings extends Vue {
  baseURL = location.origin.includes('://localhost')
    ? 'http://localhost:36393'
    : location.origin

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
