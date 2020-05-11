<template lang="pug">
#App
  b-loading(active v-if="isLoading")
  component(v-else-if="layout" :is="layout")
    router-view
  router-view(v-else)
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'

@Component
export default class App extends Vue {
  isLoading = false

  get layout () {
    const layout = this.$route.meta.layout
    return layout ? `${layout}-layout` : null
  }
}
</script>
