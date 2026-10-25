/**
 * 管理端业务层的统一业务错误（工单 #5）：
 * 携带语义化 HTTP 状态码（400 参数非法 / 404 不存在 / 409 唯一约束冲突），
 * 由 server/utils/admin.ts 的 defineAdminHandler 统一映射为 { error } 响应体。
 * 模式与 auth.service 的 AuthError 一致：业务层不触碰 h3。
 */
export class AdminError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
