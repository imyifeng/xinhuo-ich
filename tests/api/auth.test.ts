import { beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from '@node-rs/argon2'
import { PrismaClient } from '../../server/generated/prisma/client'
import { useRedis } from '../../server/utils/redis'

// 会话共享契约（server/utils/session.ts 文档头，规格 #1 / 工单 T2-T3 约定）：
// Cookie 名 xinhuo_session（httpOnly、SameSite=Lax、路径 /）；Redis 键 session:<token>，TTL 7 天。
// 测试以字面量固化为契约断言（独立事实来源），契约变更会在此处显式失败。
const SESSION_COOKIE = 'xinhuo_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

/** 从响应 Set-Cookie 头中取出契约 Cookie（"xinhuo_session=token; ..."），供后续请求携带 */
function sessionCookieOf(res: Response): string | undefined {
  return res.headers
    .getSetCookie()
    .find(c => c.startsWith(`${SESSION_COOKIE}=`))
}

// 接缝 1：认证 HTTP API 集成测试 —— 真实 Nitro 服务 + 测试专用 Postgres（globalSetup 已重置）。
// 只断言外部行为：请求进 → 响应出 + 数据库状态变，不触及内部实现。
describe('认证竖切 /api/auth', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  beforeAll(async () => {
    // globalSetup 已把 DATABASE_URL 指向测试库
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await prisma.user.deleteMany()
    // 登录夹具：经 Prisma 造数（密码哈希由测试侧独立用 argon2 生成）
    await prisma.user.create({
      data: {
        username: 'login_user',
        displayName: '登录测试',
        passwordHash: await hash('login-pass-123'),
      },
    })
  })

  describe('POST /api/auth/register', () => {
    it('合法用户名与密码注册成功，返回 201 与用户信息（不含密码哈希）', async () => {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'learner_wang', password: 'passw0rd-长密码', displayName: '小王' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body).toMatchObject({
        username: 'learner_wang',
        displayName: '小王',
        role: 'LEARNER',
      })
      expect(body.passwordHash).toBeUndefined()
    })

    it('密码以 argon2 哈希落库（数据库状态断言）', async () => {
      const user = await prisma.user.findUnique({ where: { username: 'learner_wang' } })
      expect(user?.passwordHash).toMatch(/^\$argon2/)
    })

    it('displayName 缺省时回退为用户名', async () => {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'learner_liu', password: 'passw0rd-长密码' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({ username: 'learner_liu', displayName: 'learner_liu' })
    })

    it('重复用户名返回 409', async () => {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'learner_wang', password: 'passw0rd-长密码' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(409)
      expect((await res.json() as { error?: string }).error).toBeTruthy()
    })

    it.each([
      ['过短（2 字符）', 'ab'],
      ['过长（31 字符）', 'a'.repeat(31)],
      ['含非法字符', '张三三'],
      ['含空格', 'a b ccc'],
      ['空字符串', ''],
    ])('非法用户名（%s）返回 400', async (_name, username) => {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password: 'passw0rd-长密码' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(400)
    })

    it('密码不足 8 位返回 400', async () => {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'learner_zhao', password: 'short7' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(400)
    })

    it('缺少字段返回 400', async () => {
      const noPassword = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'learner_qian' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(noPassword.status).toBe(400)
      const noUsername = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ password: 'passw0rd-长密码' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(noUsername.status).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('正确密码登录成功，签发 httpOnly 会话 Cookie 并返回用户信息', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'login_user', password: 'login-pass-123' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toMatchObject({ username: 'login_user', displayName: '登录测试', role: 'LEARNER' })
      expect(body.passwordHash).toBeUndefined()

      const cookie = sessionCookieOf(res)
      expect(cookie).toBeTruthy()
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/SameSite=Lax/i)
      expect(cookie).toMatch(/Path=\//)
    })

    it('会话写入 Redis（共享契约：session:<token>，TTL 7 天）', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'login_user', password: 'login-pass-123' }),
        headers: { 'content-type': 'application/json' },
      })
      const token = sessionCookieOf(res)!.split(';')[0].split('=')[1]
      const { id } = await res.json() as { id: number }

      const redis = useRedis()
      const raw = await redis.get(`session:${token}`)
      expect(raw).toBeTruthy()
      const payload = JSON.parse(raw!) as { userId: number, role: string }
      expect(payload.userId).toBe(id)
      expect(payload.role).toBe('LEARNER')
      const ttl = Number(await redis.ttl(`session:${token}`))
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS)
    })

    it('密码错误返回 401', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'login_user', password: 'wrong-password' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(401)
      expect((await res.json() as { error?: string }).error).toBeTruthy()
    })

    it('用户名不存在返回 401（与密码错误同语意，不泄漏账号存在性）', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'no_such_user_42', password: 'whatever-pass' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(401)
    })

    it('缺少字段返回 401', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'login_user' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(401)
    })
  })
})
