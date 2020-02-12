import Vue from 'vue'
// @ts-ignore
import VueMq from 'vue-mq'

Vue.use(VueMq, {
  breakpoints: {
    sm: 500,
    md: 800,
    lg: Infinity,
  },
})
