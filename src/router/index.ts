import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Shelf',
    component: () => import('@/views/Shelf.vue'),
    meta: { title: '书架' }
  },
  {
    path: '/reader/:bookId',
    name: 'Reader',
    component: () => import('@/views/Reader.vue'),
    meta: { title: '阅读' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/explorer',
    name: 'Explorer',
    component: () => import('@/views/Explorer.vue'),
    meta: { title: '文件浏览' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - 小说阅读器`
  }
  next()
})

export default router
