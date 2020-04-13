import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const router = new VueRouter({
  routes: [
    {
      path: '/lesson',
      alias: '/',
      component: () => import('@/views/Lesson.vue')
    },
    {
      path: '/quiz/:name',
      component: () => import('@/views/Quiz.vue')
    },
    {
      path: '/edit',
      component: () => import('@/views/Edit.vue')
    },
    {
      path: '/browse',
      component: () => import('@/views/Browse.vue')
    },
    {
      path: '/community',
      component: () => import('@/views/Community.vue')
    }
  ]
})

export default router
