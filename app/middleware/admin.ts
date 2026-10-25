/**
 * /admin 页面路由守卫（双层守卫之内层，工单 #5）：
 * 服务端中间件（server/middleware/admin-page-guard.ts）已拦截 SSR 请求，
 * 这里覆盖客户端路由跳转（不经过服务端）的场景。
 * 用 useRequestFetch 保证 SSR 阶段透传请求 Cookie（普通 $fetch 不转发）；
 * 角色以 /api/auth/me 的数据库结果为准（角色查库，与 requireAdmin 一致）。
 */
export default defineNuxtRouteMiddleware(async () => {
  const requestFetch = useRequestFetch()
  const user = await requestFetch<{ role?: string }>('/api/auth/me').catch(() => null)
  if (!user || user.role !== 'ADMIN') {
    return navigateTo('/login')
  }
})
