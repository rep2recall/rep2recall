<template lang="pug">
.u-flex.u-col
  div(style="margin-top: 1em;")
    h4.title.is-4 API Key
  .u-flex.u-row.u-m-2em
    div(style="margin-right: 1em;")
      code(style="word-break: break-all;") {{apiKey}}
    .u-grow
    button.button.is-danger(@click="resetApiKey") Reset
  p
    span Please login with API key using&nbsp;
    a(
      href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#Basic_authentication_scheme"
      target="_blank"
      alt="MDN Basic Authentication"
    ) Basic Authentication
    span &nbsp;
    code your@email.com:api_key
    span &nbsp;with base64 encoding.
  p
    span The API documentation is at&nbsp;
    a(:href="apiUrl" target="_blank" alt="API URL") {{apiUrl}}
    span &nbsp;.
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import { AxiosInstance } from 'axios'

@Component
export default class Settings extends Vue {
  apiKey = ''

  get apiUrl () {
    return new URL('/api/doc', process.env.VUE_APP_BASE_URL).href
  }

  async created () {
    const api = await this.getApi()
    this.apiKey = (await api.get('/api/user/')).data.secret
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  resetApiKey () {
    this.$buefy.dialog.confirm({
      message: 'Are you sure you want to reset the API key? This cannot be undone.',
      type: 'is-danger',
      hasIcon: true,
      onConfirm: async () => {
        const api = await this.getApi()
        this.apiKey = (await api.patch('/api/user/secret')).data.secret
      }
    })
  }
}
</script>
