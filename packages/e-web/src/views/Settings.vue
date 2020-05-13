<template lang="pug">
.u-flex.u-col(style="margin-top: 1em;")
  div
    h4.title.is-4 Upload from archives
  .u-flex.u-m-2em(style="align-items: center; justify-content: center;")
    b-field
      b-upload(
        v-model="dropFile"
        :multiple="false"
        drag-drop
        accept=".r2r,.apkg,.anki2"
      )
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
  b-modal(:active="dropFile" :can-cancel="false")
    .card(v-if="dropFile" v-for="d, i in [dropFile]" :key="i")
      .card-content
        b-field(:label="d.name")
          b-progress(:value="dotProp.get(d, 'msg.progress')" :type="dotProp.get(d, 'msg.type')" show-value)
            | {{dotProp.get(d, 'msg.text')}}
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import { AxiosInstance } from 'axios'
import dotProp from 'dot-prop'

@Component
export default class Settings extends Vue {
  dropFile: any = null
  apiKey = ''

  dotProp = dotProp

  get apiUrl () {
    return '/api/doc'
  }

  async created () {
    const api = await this.getApi()
    this.apiKey = (await api.get('/api/user/')).data.secret
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  @Watch('dropFile')
  async onDropFile () {
    if (this.dropFile) {
      const f = this.dropFile

      this.$set(f, 'msg', { text: '', type: '' })

      const formData = new FormData()
      formData.append('file', f)

      const api = await this.getApi()
      const r = await api.post('/api/file/upload', formData, {
        onUploadProgress: (evt: ProgressEvent) => {
          f.msg.text = `Uploading: ${(evt.loaded / evt.total * 100).toFixed(0)}%`
          f.msg.type = 'is-warning'
          this.$forceUpdate()
        }
      })
      const oldId = r.data.id

      const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/api/file/process`)
      ws.onopen = () => {
        f.msg.text = 'Processing...'
        f.msg.type = 'is-success'
        this.$forceUpdate()

        const [,, type] = /^(.+)\.([^.]+)$/.exec(f.name) || ['', f.name, '']
        ws.send(JSON.stringify({ id: oldId, filename: f.name, type }))
      }
      ws.onmessage = (evt) => {
        const { id, status, error } = JSON.parse(evt.data)

        if (id === oldId) {
          if (error) {
            this.$buefy.dialog.alert({
              message: error
            })
          } else {
            if (status !== 'done') {
              f.msg.text = `Processing: ${status}`
              f.msg.type = 'is-success'
              this.$forceUpdate()
            } else {
              this.dropFile = null
            }
          }
        }
      }
    }
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
