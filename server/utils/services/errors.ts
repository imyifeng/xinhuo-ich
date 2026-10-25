/**
 * 共享业务错误（同形域错误的收敛，Standards 重构）：
 * 各业务域曾各自定义同形错误类（AuthError / CourseError / AdminError，均为 status + message），
 * 内容域还误用了 AuthError 表达校验语义。现统一为一个携带语义化 HTTP 状态码的 BusinessError，
 * 由接入层包装器（server/utils/guards.ts 的 defineGuardedHandler）映射为 { error } 响应体。
 * 各域语义映射（400/404/409 等）由构造处决定；原域名以别名保留，调用点语义不变。
 */
export class BusinessError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
