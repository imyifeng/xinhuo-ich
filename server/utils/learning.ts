import type { H3Event } from 'h3'
import { defineGuardedHandler, requireUserWithRoles } from './guards'

/**
 * 学习者端共享设施（工单 #6）：登录守卫 + 业务错误映射。
 * 学习动作（开始课程/标记完成/我的进度）要求登录（未登录 401，前端引导登录）；
 * 任意已登录角色均可学习（传承人/管理员同样可标记完成）。
 * 守卫与错误映射的共享实现在 server/utils/guards.ts，此处仅声明本端语义。
 */

/** 登录守卫：无有效会话或用户已删除 401；任意已登录角色放行 */
export function requireSessionUser(event: H3Event) {
  return requireUserWithRoles(event, { unauthenticated: { status: 401, message: '请先登录' } })
}

/** 学习者端接入层统一包装：业务错误（400/404/409 等）映射为 { error } 响应体 */
export const defineCourseHandler = defineGuardedHandler
