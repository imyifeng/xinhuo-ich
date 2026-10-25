import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'

// 接缝 1：认证 HTTP API 集成测试 —— 真实 Nitro 服务 + 测试专用 Postgres（globalSetup 已重置）。
// 只断言外部行为：请求进 → 响应出 + 数据库状态变，不触及内部实现。

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
    return 200
  }
  catch (error) {
    const err = error as { status?: number, statusCode?: number }
    return err.status ?? err.statusCode ?? 0
  }
}

describe('认证竖切 /api/auth', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  beforeAll(async () => {
    // globalSetup 已把 DATABASE_URL 指向测试库
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await prisma.user.deleteMany()
  })

  describe('POST /api/auth/register', () => {
    it('合法用户名与密码注册成功，返回 201 与用户信息（不含密码哈希）', async () => {
      const body = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { username: 'learner_wang', password: 'passw0rd-长密码', displayName: '小王' },
      })
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
      const body = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { username: 'learner_liu', password: 'passw0rd-长密码' },
      })
      expect(body).toMatchObject({ username: 'learner_liu', displayName: 'learner_liu' })
    })

    it('重复用户名返回 409', async () => {
      const status = await statusOf($fetch('/api/auth/register', {
        method: 'POST',
        body: { username: 'learner_wang', password: 'passw0rd-长密码' },
      }))
      expect(status).toBe(409)
    })

    it.each([
      ['过短（2 字符）', 'ab'],
      ['过长（31 字符）', 'a'.repeat(31)],
      ['含非法字符', '张三三'],
      ['含空格', 'a b ccc'],
      ['空字符串', ''],
    ])('非法用户名（%s）返回 400', async (_name, username) => {
      const status = await statusOf($fetch('/api/auth/register', {
        method: 'POST',
        body: { username, password: 'passw0rd-长密码' },
      }))
      expect(status).toBe(400)
    })

    it('密码不足 8 位返回 400', async () => {
      const status = await statusOf($fetch('/api/auth/register', {
        method: 'POST',
        body: { username: 'learner_zhao', password: 'short7' },
      }))
      expect(status).toBe(400)
    })

    it('缺少字段返回 400', async () => {
      const noPassword = await statusOf($fetch('/api/auth/register', {
        method: 'POST',
        body: { username: 'learner_qian' },
      }))
      expect(noPassword).toBe(400)
      const noUsername = await statusOf($fetch('/api/auth/register', {
        method: 'POST',
        body: { password: 'passw0rd-长密码' },
      }))
      expect(noUsername).toBe(400)
    })
  })
})
