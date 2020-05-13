import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const registeredLayouts = [
  'App'
]

registeredLayouts.map((layout) => {
  Vue.component(`${layout}-layout`, () => import(/* webpackChunkName: "[request]-layout" */ `../layouts/${layout}.vue`))
})

const router = new VueRouter({
  mode: 'hash',
  routes: [
    {
      path: '/',
      redirect: '/lesson'
    },
    {
      path: '/lesson',
      component: () => import(/* webpackChunkName: "[request]" */ '../views/Lesson.vue'),
      meta: {
        layout: 'App'
      }
    },
    {
      path: '/quiz/:name',
      component: () => import(/* webpackChunkName: "[request]" */ '../views/Quiz.vue'),
      meta: {
        layout: 'App'
      }
    },
    {
      path: '/edit',
      component: () => import(/* webpackChunkName: "[request]" */ '../views/Edit.vue'),
      meta: {
        layout: 'App'
      }
    },
    {
      path: '/browse',
      component: () => import(/* webpackChunkName: "[request]" */ '../views/Browse.vue'),
      meta: {
        layout: 'App'
      }
    },
    {
      path: '/settings',
      component: () => import(/* webpackChunkName: "[request]" */ '../views/Settings.vue'),
      meta: {
        layout: 'App'
      }
    },
    {
      path: '/community',
      component: () => import(/* webpackChunkName: "[request]" */ '../views/Community.vue'),
      meta: {
        layout: 'App'
      }
    }
  ]
})

export default router
