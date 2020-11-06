import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      redirect: '/quiz'
    },
    {
      path: '/quiz',
      component: () => import(/* webpackChunkName: "quiz" */ '@/views/Quiz.vue')
    }
  ]
})

export default router
