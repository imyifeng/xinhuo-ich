/**
 * /studio 创作端页面路由守卫（工单 #6）：
 * 仅传承人与管理员可进入课程创作工作台，其余（含游客）重定向到 /login。
 * 接口侧由 requireStudioUser 兜底（401/403），这里是页面级引导。
 * 用 useRequestFetch 保证 SSR 阶段透传请求 Cookie；角色以 /api/auth/me 数据库结果为准。
 */
export default defineNuxtRouteMiddleware(async () => {
  const requestFetch = useRequestFetch()
  const user = await requestFetch<{ role?: string }>('/api/auth/me').catch(() => null)
  if (!user || (user.role !== 'INHERITOR' && user.role !== 'ADMIN')) {
    return navigateTo('/login')
  }
})
