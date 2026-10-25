import type { H3Event } from 'h3'
import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { getSessionUser } from './session'
import { getUserById } from './services/auth.service'
import { AdminError } from './services/admin-error'

/**
 * 管理端共享设施（工单 #5）：角色守卫 + 业务错误映射。
 */

/**
 * 管理端角色守卫：未登录（无有效会话）或非 ADMIN 一律 403（工单明确未登录也是 403，非 401）。
 * 角色以数据库为准（规格 #1 认证决策「角色查库」）：管理员调整角色后立即生效，
 * 不依赖会话里可能过期的角色快照；用户已被删除时同样拒绝。
 */
export async function requireAdmin(event: H3Event): Promise<void> {
  const session = await getSessionUser(event)
  const user = session ? await getUserById(session.userId) : null
  if (!user || user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: '需要管理员权限' })
  }
}

/**
 * 管理端接入层统一包装：业务层 AdminError（400/404/409 等）映射为
 * { error } 响应体 + 对应状态码；其余错误原样抛出交框架兜底 500。
 */
export function defineAdminHandler(handler: (event: H3Event) => Promise<unknown>) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    }
    catch (error) {
      if (error instanceof AdminError) {
        setResponseStatus(event, error.status)
        return { error: error.message }
      }
      throw error
    }
  })
}
