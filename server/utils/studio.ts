import type { H3Event } from 'h3'
import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { getSessionUser } from './session'
import { getUserById } from './services/auth.service'
import type { PublicUser } from './services/auth.service'
import { CourseError } from './services/course.service'

/**
 * 传承人创作端共享设施（工单 #6）：角色守卫 + 业务错误映射。
 * 与管理端（server/utils/admin.ts）同构，但面向前台创作：未登录 401（引导登录），
 * 已登录非传承人/管理员 403。
 */

/**
 * 创作端角色守卫：INHERITOR 或 ADMIN 放行（管理员可代操作）。
 * 角色以数据库为准（规格 #1 认证决策「角色查库」），与 requireAdmin 一致。
 */
export async function requireStudioUser(event: H3Event): Promise<PublicUser> {
  const session = await getSessionUser(event)
  const user = session ? await getUserById(session.userId) : null
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: '请先登录' })
  }
  if (user.role !== 'INHERITOR' && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: '需要传承人权限' })
  }
  return user
}

/** 创作端接入层统一包装：CourseError（400/404/409 等）映射为 { error } 响应体 + 对应状态码 */
export function defineStudioHandler(handler: (event: H3Event) => Promise<unknown>) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    }
    catch (error) {
      if (error instanceof CourseError) {
        setResponseStatus(event, error.status)
        return { error: error.message }
      }
      throw error
    }
  })
}
