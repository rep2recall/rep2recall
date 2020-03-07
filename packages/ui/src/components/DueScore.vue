<template lang="pug">
.due-score
  .count(style="color: red;") {{count('leech') | nonZero | format}}
  .count(style="color: blue;") {{count('due') | nonZero | format}}
  .count(style="color: green;") {{count('new') | nonZero | format}}
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'

@Component
export default class DueScore extends Vue {
  @Prop({ required: true }) data!: any[]
  @Prop({ required: true }) deck!: string
  @Prop({ default: false }) exact!: string

  get decksOrSubDecks () {
    return this.data
      .filter(it => (this.exact ? false : it.deck.startsWith(`${this.deck}/`)) || it.deck === this.deck)
  }

  mounted () {
    if (this.count('leech') + this.count('due') + this.count('new') > 0) {
      this.$emit('has-review', true)
    } else {
      this.$emit('has-review', false)
    }
  }

  updated () {
    if (this.count('leech') + this.count('due') + this.count('new') > 0) {
      this.$emit('has-review', true)
    } else {
      this.$emit('has-review', false)
    }
  }

  count (key: string) {
    return this.decksOrSubDecks.map(it => it[key]).reduce((acc, c) => acc + c, 0) as number
  }
}
</script>

<style lang="scss">
.due-score {
  display: flex;

  .count {
    display: inline-flex;
    width: 3rem;
    direction: rtl;
  }
}
</style>
