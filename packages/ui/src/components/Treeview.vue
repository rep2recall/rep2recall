<template lang="pug">
ul.menu-list
  TreeItem(
    v-for="it in decksAtThisLevel" :key="it.deck"
    :deck="it.deck" :data="data" :handler="handler" :depth="depth"
  )
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'

import TreeItem from './TreeItem.vue'

@Component({
  components: {
    TreeItem
  }
})
export default class Treeview extends Vue {
  @Prop({ required: true }) data!: any[]
  @Prop({ required: true }) handler!: any
  @Prop({ default: 0 }) depth!: number

  get decksAtThisLevel () {
    const subData = {} as any

    this.data
      .map((d) => ({
        ...d,
        ds: d.deck.split('/')
      }))
      .filter(({ ds }) => ds.length >= this.depth + 1)
      .map((it) => {
        const deck = it.ds.slice(0, this.depth + 1).join('/')

        if (!subData[deck]) {
          subData[deck] = {
            ...it,
            hasReview: false,
            deck
          }
        }
      })
    
    return Object.entries(subData).sort(([a], [b]) => a.localeCompare(b)).map(([_, v]) => v) as any[]
  }
}
</script>

<style lang="scss">
.menu-list {
  .caret {
    display: inline-flex;
    width: 1rem;
    height: 1rem;
    align-content: center;
    justify-content: center;
    margin-right: 0.3rem;
  }

  a {
    display: flex;
  }

  li ul {
    margin: 0;
    margin-left: 1.2rem;
  }
}
</style>
