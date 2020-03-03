import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const router = new VueRouter({
  routes: [
    {
      path: '/quiz',
      alias: '/',
      component: () => import('@/views/Quiz.vue'),
    },
  ],
})

export default router
