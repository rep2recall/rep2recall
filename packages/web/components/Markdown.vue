<template lang="pug">
.content
  component(:is="dynamicComponent")
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'
import Prism from 'prismjs'
import 'prismjs/themes/prism.css'
import MakeHtml from '@/assets/make-html'

@Component
export default class Markdown extends Vue {
  @Prop({ required: true, default: '' }) content!: string
  @Prop({ default: () => ({}) }) ctx!: Record<string, any>

  makeHtml = new MakeHtml()

  dynamicComponent = Vue.extend({
    computed: {
      ctx: () => this.ctx,
    },
    mounted() {
      Prism.highlightAllUnder(this.$el)
    },
    template: this.makeHtml.getHTML(this.content),
  })
}
</script>
