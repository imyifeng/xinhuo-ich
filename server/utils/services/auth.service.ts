import { hash } from '@node-rs/argon2'
import type { Role, User } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'

/**
 * 认证业务层：注册 / 登录校验 / 会话签发（会话写入委托 session.ts 共享契约）。
 * 校验规则与错误文案属于 API 对外契约的一部分（tests/api/auth.test.ts 断言状态码）。
 */

export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,30}$/
export const USERNAME_RULE = '用户名需为 3~30 个字符，仅限字母、数字、下划线、连字符'
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const DISPLAY_NAME_MAX_LENGTH = 30

/** 面向前端/接口的用户公开字段（passwordHash 永不出库） */
export interface PublicUser {
  id: number
  username: string
  displayName: string
  role: Role
  createdAt: string
}

/** 带语义状态码的业务错误，由接入层映射为 HTTP 响应 */
export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export interface RegisterInput {
  username: unknown
  password: unknown
  displayName?: unknown
}

/** 注册：校验（用户名 3~30 字符唯一 + 密码 ≥8 位）→ argon2 哈希落库，返回公开用户信息 */
export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const { username, password, displayName } = input

  if (!isNonEmptyString(username) || !USERNAME_PATTERN.test(username)) {
    throw new AuthError(400, USERNAME_RULE)
  }
  if (!isNonEmptyString(password)
    || password.length < PASSWORD_MIN_LENGTH
    || password.length > PASSWORD_MAX_LENGTH) {
    throw new AuthError(400, `密码需为 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH} 个字符`)
  }

  let nickname = username
  if (displayName !== undefined) {
    if (!isNonEmptyString(displayName) || displayName.trim().length > DISPLAY_NAME_MAX_LENGTH) {
      throw new AuthError(400, `昵称需为 1~${DISPLAY_NAME_MAX_LENGTH} 个字符`)
    }
    nickname = displayName.trim()
  }

  try {
    const user = await usePrisma().user.create({
      data: {
        username,
        displayName: nickname,
        passwordHash: await hash(password),
      },
    })
    return toPublicUser(user)
  }
  catch (error) {
    // 用户名唯一约束冲突（P2002）：并发下重复注册也统一 409
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new AuthError(409, '用户名已被占用')
    }
    throw error
  }
}
