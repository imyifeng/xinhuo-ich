import type { H3Event } from 'h3'
import { defineGuardedHandler, requireUserWithRoles } from './guards'

/**
 * 管理端共享设施（工单 #5）：角色守卫 + 业务错误映射。
 * 守卫与错误映射的共享实现在 server/utils/guards.ts，此处仅声明本端语义。
 */

/**
 * 管理端角色守卫：未登录（无有效会话）或非 ADMIN 一律 403（工单明确未登录也是 403，非 401）。
 */
export function requireAdmin(event: H3Event) {
  return requireUserWithRoles(event, {
    roles: ['ADMIN'],
    unauthenticated: { status: 403, message: '需要管理员权限' },
    forbidden: { status: 403, message: '需要管理员权限' },
  })
}

/**
 * 管理端接入层统一包装：业务层错误（400/404/409 等）映射为 { error } 响应体 +
 * 对应状态码；其余错误原样抛出交框架兜底 500。
 */
export const defineAdminHandler = defineGuardedHandler
