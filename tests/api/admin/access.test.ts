import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from '../helpers'

// 接缝 1：管理端访问控制（工单 #5）——
// 管理接口未登录/非管理员一律 403（工单明确未登录也是 403 而非 401）；
// /admin 页面 SSR 请求由服务端中间件重定向到 /login（双层守卫之外层）。
describe('管理端访问控制', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let learnerCookie: string

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const learner = await createUser(prisma, 'guard_learner')
    learnerCookie = await createSessionCookie(learner.id)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('未登录访问管理接口返回 403（未登录也是 403，非 401）', async () => {
    const res = await apiFetch('/api/admin/users')
    expect(res.status).toBe(403)
  })

  it('学习者会话访问管理接口返回 403', async () => {
    const res = await apiFetch('/api/admin/users', { headers: { cookie: learnerCookie } })
    expect(res.status).toBe(403)
  })

  it('未登录访问 /admin 页面被服务端中间件重定向到 /login', async () => {
    const res = await apiFetch('/admin', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
  })

  it('学习者会话访问 /admin 页面被重定向到 /login', async () => {
    const res = await apiFetch('/admin', { headers: { cookie: learnerCookie }, redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
  })

  it('伪造无效会话访问管理接口同样 403', async () => {
    const res = await apiFetch('/api/admin/users', { headers: { cookie: 'xinhuo_session=forged-token' } })
    expect(res.status).toBe(403)
  })
})
