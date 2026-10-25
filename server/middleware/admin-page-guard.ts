import { getUserById } from '../utils/services/auth.service'

/**
 * /admin 页面守卫（双层守卫之外层，工单 #5）：
 * SSR 阶段拦截非管理员的 /admin 页面请求，重定向到 /login。
 * 仅作用于 GET 的页面路径（/admin 与 /admin/**）；
 * /api/admin/** 的接口请求不走这里，由各接口的 requireAdmin 统一返回 403。
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return
  const pathname = event.path.split('?')[0]!
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return

  const session = await getSessionUser(event)
  const user = session ? await getUserById(session.userId) : null
  if (!user || user.role !== 'ADMIN') {
    return sendRedirect(event, '/login', 302)
  }
})
