<template lang="pug">
.u-flex.u-col(style="margin-top: 1em;")
  div
    h4.title.is-4 Upload from archives
  .u-flex(style="align-items: center; justify-contents: center;")
    b-field
      b-upload(v-model="dropFiles" multiple drag-drop accept=".r2r,.apkg,.anki2")
        section.section
          .content.has-text-centered
            p
              b-icon(icon="upload" size="is-large")
            p Drop your files (*.r2r, *.apkg, *.anki2) here or click to upload
  div
    h4.title.is-4 API Key
  .u-flex.u-row.u-m-2em
    div(style="margin-right: 1em;")
      code(style="word-break: break-all;") {{apiKey}}
    .u-grow
    button.button.is-danger(@click="resetApiKey") Reset
  p
    span Please login with API key using
    span &nbsp;
    a(
      href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#Basic_authentication_scheme"
      alt="MDN Basic Authentication"
    ) Basic Authentication
    span &nbsp;
    code your@email.com:api_key
    span &nbsp;
    span with base64 encoding.
  p
    span The API documentation is at
    span &nbsp;
    a(:href="apiUrl" target="_blank" alt="API URL") {{apiUrl}}
    span .
  b-modal(:active="dropFiles.length > 0")
    .card(v-for="d, i in dropFiles" :key="i")
      b-field(:label="d.name")
        b-progress(:value="d.progress" :type="d.type" show-value) {{d.text}}
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import { AxiosInstance } from 'axios'
import { remote } from 'electron'

@Component
export default class Settings extends Vue {
  dropFiles: any[] = []
  apiKey = ''

  get apiUrl () {
    return new URL('/api/doc', `http://localhost:${remote.process.env.PORT}`).href
  }

  async created () {
    const api = await this.getApi()
    this.apiKey = (await api.get('/api/user/')).data.secret
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  @Watch('dropFiles')
  async onDropFiles () {
    const api = await this.getApi()
    this.dropFiles.map(async (f) => {
      const formData = new FormData()
      formData.append('file', f)
      const r = await api.post('/api/file/upload', formData, {
        onUploadProgress: (evt: ProgressEvent) => {
          f.text = `Uploading: ${(evt.loaded / evt.total * 100).toFixed(0)}%`
          f.type = 'is-warning'
        }
      })
      const ws = new WebSocket(`ws://localhost:${remote.process.env.PORT}/api/file/process/${r.data.id}`)
      ws.onopen = () => {
        f.text = 'Processing...'
        f.type = 'is-success'

        ws.send(f.name.replace(/^.+\./, ''))
      }
      ws.onmessage = (evt) => {
        if (evt.data !== 'done') {
          f.text = `Processing: ${evt.data}`
        } else {
          this.dropFiles = this.dropFiles.filter((f0) => f0 !== f)
        }
      }
    })
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
