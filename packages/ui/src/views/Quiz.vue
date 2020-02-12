<template lang="pug">
.container
  .columns
    .column(:class="$mq === 'lg' ? 'is-10 is-offset-1' : ''")
      b-field(label="Search")
        b-input
      .menu
        Treeview(:data="data")
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'

import Treeview from '@/components/Treeview.vue'

@Component({
  components: {
    Treeview
  }
})
export default class Quiz extends Vue {
  data = [
    {
      deck: 'Default'
    },
    {
      deck: 'HSK/HSK1',
      due: 10,
      leech: 5,
      new: 20
    },
    {
      deck: 'HSK/HSK2',
      due: 7,
      leech: 10,
      new: 18
    },
    {
      deck: 'HSK/HSK2/hard',
      due: 5,
      leech: 5,
      new: 5
    }
  ]
}
</script>
