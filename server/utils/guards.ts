import type { H3Event } from 'h3'
import { createError, defineEventHandler, setResponseStatus } from 'h3'
import type { Role } from '../generated/prisma/client'
import { getSessionUser } from './session'
import { getUserById } from './services/auth.service'
import type { PublicUser } from './services/auth.service'
import { BusinessError } from './services/errors'

/**
 * 三端共享的会话守卫与业务错误映射（Standards 重构，收敛 learning/studio/admin 三份同形实现）：
 * 「读取会话 → 查库取用户 → 401/403」流程一致，仅角色谓词与拒绝语义不同。
 */

export interface RequireRoleOptions {
  /** 允许通过的角色；缺省表示任意已登录角色（学习者端学习动作，传承人/管理员同样可学习） */
  roles?: readonly Role[]
  /** 无有效会话（未登录/会话过期/用户已删除）时的响应语义：learning/studio 为 401，admin 为 403 */
  unauthenticated: { status: 401 | 403, message: string }
  /** 已登录但角色不符时的响应语义 */
  forbidden: { status: 403, message: string }
}

/** 会话守卫共享实现。角色以数据库为准（规格 #1 认证决策「角色查库」）：
 *  管理员调整角色后立即生效，不依赖会话里可能过期的角色快照；用户已被删除时同样拒绝。 */
export async function requireUserWithRoles(event: H3Event, options: RequireRoleOptions): Promise<PublicUser> {
  const session = await getSessionUser(event)
  const user = session ? await getUserById(session.userId) : null
  if (!user) {
    throw createError({
      statusCode: options.unauthenticated.status,
      statusMessage: options.unauthenticated.status === 401 ? 'Unauthorized' : 'Forbidden',
      message: options.unauthenticated.message,
    })
  }
  if (options.roles && !options.roles.includes(user.role)) {
    throw createError({
      statusCode: options.forbidden.status,
      statusMessage: 'Forbidden',
      message: options.forbidden.message,
    })
  }
  return user
}

/** 接入层统一包装（共享实现）：业务错误（BusinessError 及其各域别名，400/404/409 等）
 *  映射为 { error } 响应体 + 对应状态码；其余错误原样抛出交框架兜底 500。 */
export function defineGuardedHandler(handler: (event: H3Event) => Promise<unknown>) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    }
    catch (error) {
      if (error instanceof BusinessError) {
        setResponseStatus(event, error.status)
        return { error: error.message }
      }
      throw error
    }
  })
}
