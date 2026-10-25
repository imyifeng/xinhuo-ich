import { randomBytes } from 'node:crypto'
import { getCookie, setCookie, deleteCookie } from 'h3'
import type { H3Event } from 'h3'

/**
 * 会话契约（跨工单共享，ADR 0002 自实现认证）：
 * - Cookie 名：xinhuo_session（httpOnly，SameSite=Lax，路径 /）
 * - Redis 键：session:<token>，值为 SessionPayload 的 JSON 字符串，TTL 7 天
 * 认证模块（写入）与行为记录、角色守卫等模块（读取）共用本文件，不得另行发明格式。
 */
export const SESSION_COOKIE = 'xinhuo_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export type SessionRole = 'LEARNER' | 'INHERITOR' | 'ADMIN'

export interface SessionPayload {
  userId: number
  role: SessionRole
  createdAt: string
}

const keyOf = (token: string) => `session:${token}`

/** 读取当前会话；无会话或已过期返回 null。 */
export async function getSessionUser(event: H3Event): Promise<SessionPayload | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null
  const raw = await useRedis().get(keyOf(token))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionPayload
  } catch {
    return null
  }
}

/** 创建会话：生成随机 token 写入 Redis 并下发 httpOnly Cookie，返回 token。 */
export async function createSession(
  event: H3Event,
  payload: Omit<SessionPayload, 'createdAt'>,
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const full: SessionPayload = { ...payload, createdAt: new Date().toISOString() }
  await useRedis().set(keyOf(token), JSON.stringify(full), 'EX', SESSION_TTL_SECONDS)
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  return token
}

/** 销毁会话：删除 Redis 键并清除 Cookie。 */
export async function destroySession(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    await useRedis().del(keyOf(token))
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
