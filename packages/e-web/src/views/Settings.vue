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
    h4.title.is-4 Accessing the app programmatically (API)
  p
    span The API documentation is at
    span &nbsp;
    a(:href="apiUrl" target="_blank" alt="API URL") {{apiUrl}}
    span .
  b-modal(:active="!!dropFile" :can-cancel="false")
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

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  @Watch('dropFile')
  async onDropFile () {
    if (this.dropFile) {
      const f = this.dropFile

      this.$set(f, 'msg', { text: '', type: '', progress: null })

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

      const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/api/file/${oldId}`)
      ws.onopen = () => {
        f.msg.text = 'Processing...'
        f.msg.type = 'is-success'
        f.msg.progress = null
        this.$forceUpdate()

        const [,, type] = /^(.+)\.([^.]+)$/.exec(f.name) || ['', f.name, '']
        ws.send(JSON.stringify({ id: oldId, filename: f.name, type }))
      }
      ws.onmessage = (evt) => {
        const { id, message, status, percent } = JSON.parse(evt.data)

        if (id === oldId) {
          if (status === 'error') {
            this.$buefy.dialog.alert({
              message
            })
          } else {
            if (status !== 'complete') {
              f.msg.text = `Processing: ${message}`
              f.msg.type = 'is-success'
              f.msg.progress = percent
              this.$forceUpdate()
            } else {
              this.dropFile = null
            }
          }
        }
      }
    }
  }
}
</script>
