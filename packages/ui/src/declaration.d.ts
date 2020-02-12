import Vue from 'vue'

declare module 'vue/types/vue' {
  interface Vue {
    $mq: 'sm' | 'md' | 'lg'
  }
}
