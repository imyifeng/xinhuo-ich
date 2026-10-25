import type { H3Event } from 'h3'
import { defineGuardedHandler, requireUserWithRoles } from './guards'

/**
 * 传承人创作端共享设施（工单 #6）：角色守卫 + 业务错误映射。
 * 与管理端（server/utils/admin.ts）同构，但面向前台创作：未登录 401（引导登录），
 * 已登录非传承人/管理员 403。守卫与错误映射的共享实现在 server/utils/guards.ts。
 */

/** 创作端角色守卫：INHERITOR 或 ADMIN 放行（管理员可代操作）；角色以数据库为准，与 requireAdmin 一致 */
export function requireStudioUser(event: H3Event) {
  return requireUserWithRoles(event, {
    roles: ['INHERITOR', 'ADMIN'],
    unauthenticated: { status: 401, message: '请先登录' },
    forbidden: { status: 403, message: '需要传承人权限' },
  })
}

/** 创作端接入层统一包装：业务错误（400/404/409 等）映射为 { error } 响应体 + 对应状态码 */
export const defineStudioHandler = defineGuardedHandler
