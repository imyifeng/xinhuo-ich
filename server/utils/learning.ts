import type { H3Event } from 'h3'
import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { getSessionUser } from './session'
import { getUserById } from './services/auth.service'
import type { PublicUser } from './services/auth.service'
import { CourseError } from './services/course.service'

/**
 * 学习者端共享设施（工单 #6）：登录守卫 + 业务错误映射。
 * 学习动作（开始课程/标记完成/我的进度）要求登录（未登录 401，前端引导登录）；
 * 任意已登录角色均可学习（传承人/管理员同样可标记完成）。
 */

/** 登录守卫：无有效会话或用户已删除 401；角色查库与会话契约一致 */
export async function requireSessionUser(event: H3Event): Promise<PublicUser> {
  const session = await getSessionUser(event)
  const user = session ? await getUserById(session.userId) : null
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: '请先登录' })
  }
  return user
}

/** 学习者端接入层统一包装：CourseError（400/404/409 等）映射为 { error } 响应体 */
export function defineCourseHandler(handler: (event: H3Event) => Promise<unknown>) {
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
