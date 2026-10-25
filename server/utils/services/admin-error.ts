import { BusinessError } from './errors'

/**
 * 管理端业务错误与 Prisma 约束错误判别（工单 #5）。
 * AdminError 为共享 BusinessError 的管理端别名（400/404/409 语义由构造处决定），
 * 由 server/utils/admin.ts 统一映射为响应。
 */
export { BusinessError as AdminError }

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
