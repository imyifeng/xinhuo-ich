import { hash, verify } from '@node-rs/argon2'
import type { Role, User } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { BusinessError as AuthError } from './errors'

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

/** 带语义状态码的业务错误（共享 BusinessError 的认证域别名），由接入层映射为 HTTP 响应 */
export { AuthError }

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

/** 用户名不存在时的占位校验哈希：抹平"用户名不存在"与"密码错误"的响应耗时差 */
let dummyHash: Promise<string> | undefined

export interface LoginInput {
  username: unknown
  password: unknown
}

/** 登录：argon2 校验密码；用户名不存在与密码错误统一 401，不泄漏账号存在性 */
export async function authenticateUser(input: LoginInput): Promise<PublicUser> {
  const { username, password } = input
  if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
    throw new AuthError(401, '用户名或密码错误')
  }

  const user = await usePrisma().user.findUnique({ where: { username } })
  if (!user) {
    dummyHash ??= hash('xinhuo-timing-equalizer-dummy-password')
    await verify(await dummyHash, password).catch(() => false)
    throw new AuthError(401, '用户名或密码错误')
  }

  const valid = await verify(user.passwordHash, password).catch(() => false)
  if (!valid) {
    throw new AuthError(401, '用户名或密码错误')
  }
  return toPublicUser(user)
}

/** 按会话中的 userId 取当前用户；用户已被删除返回 null（调用方决定 401） */
export async function getUserById(id: number): Promise<PublicUser | null> {
  const user = await usePrisma().user.findUnique({ where: { id } })
  return user ? toPublicUser(user) : null
}
