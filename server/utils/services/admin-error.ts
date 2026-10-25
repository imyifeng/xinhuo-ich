/**
 * 管理端业务错误与 Prisma 约束错误判别（工单 #5）。
 * AdminError 携带语义化 HTTP 状态码，由 server/utils/admin.ts 统一映射为响应。
 */
export class AdminError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Prisma 唯一约束冲突（P2002） */
export function isUniqueViolation(error: unknown): boolean {
  return hasPrismaCode(error, 'P2002')
}

/** Prisma 目标记录不存在（P2025，update/delete 落空） */
export function isRecordNotFound(error: unknown): boolean {
  return hasPrismaCode(error, 'P2025')
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
