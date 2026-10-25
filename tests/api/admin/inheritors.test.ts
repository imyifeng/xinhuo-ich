import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { createCraftItem, createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from '../helpers'

// 接缝 1：管理端传承人 CRUD（工单 #5 / 用户故事 21）——
// 传承人人物条目挂在技艺条目下，管理员可完整增删改查；
// 未登录与非管理员一律 403。

let prisma: PrismaClient
let adminCookie: string
let learnerCookie: string

function inheritorBody(overrides: Record<string, unknown> = {}) {
  return {
    name: `传承人-${Math.random().toString(36).slice(2, 8)}`,
    level: '国家级',
    bio: '代表性传承人简介',
    ...overrides,
  }
}

async function postInheritor(body: unknown, cookie = adminCookie) {
  return apiFetch('/api/admin/inheritors', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('管理端传承人 CRUD /api/admin/inheritors', async () => {
  await setup({ server: true })

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const admin = await createUser(prisma, 'inheritor_admin', 'ADMIN')
    const learner = await createUser(prisma, 'inheritor_learner')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
    learnerCookie = await createSessionCookie(learner.id)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('未登录与学习者创建传承人均 403', async () => {
    const item = await createCraftItem(prisma, { name: `条目-${Math.random().toString(36).slice(2, 8)}` })
    const body = inheritorBody({ craftItemId: item.id })
    expect((await postInheritor(body, '')).status).toBe(403)
    expect((await postInheritor(body, learnerCookie)).status).toBe(403)
  })

  it('管理员创建传承人（挂条目）返回 201；所属条目不存在返回 400', async () => {
    const item = await createCraftItem(prisma, { name: `条目-${Math.random().toString(36).slice(2, 8)}` })
    const body = inheritorBody({ craftItemId: item.id })
    const res = await postInheritor(body)
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toMatchObject({
      name: body.name,
      level: '国家级',
      bio: '代表性传承人简介',
      craftItemId: item.id,
    })
    expect(await prisma.inheritor.findUnique({
      where: { craftItemId_name: { craftItemId: item.id, name: body.name } },
    })).not.toBeNull()

    const missingItem = await postInheritor(inheritorBody({ craftItemId: 'nonexistent-item' }))
    expect(missingItem.status).toBe(400)
  })

  it('同一条目下传承人重名返回 409；不同条目允许同名', async () => {
    const itemA = await createCraftItem(prisma, { name: `条目A-${Math.random().toString(36).slice(2, 8)}` })
    const itemB = await createCraftItem(prisma, { name: `条目B-${Math.random().toString(36).slice(2, 8)}` })
    const body = inheritorBody({ craftItemId: itemA.id })
    expect((await postInheritor(body)).status).toBe(201)
    expect((await postInheritor(body)).status).toBe(409)
    expect((await postInheritor({ ...body, craftItemId: itemB.id })).status).toBe(201)
  })

  it('列表支持按条目筛选并附带条目名称', async () => {
    const item = await createCraftItem(prisma, { name: `条目-${Math.random().toString(36).slice(2, 8)}` })
    const other = await createCraftItem(prisma, { name: `条目-${Math.random().toString(36).slice(2, 8)}` })
    const created = await (await postInheritor(inheritorBody({ craftItemId: item.id }))).json()
    await postInheritor(inheritorBody({ craftItemId: other.id }))

    const res = await apiFetch(`/api/admin/inheritors?craftItemId=${item.id}`, { headers: { cookie: adminCookie } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({ id: created.id, craftItemId: item.id, craftItemName: item.name })

    // 学习者访问列表 403
    expect((await apiFetch('/api/admin/inheritors', { headers: { cookie: learnerCookie } })).status).toBe(403)
  })

  it('更新传承人：字段生效且可改挂条目；不存在 404', async () => {
    const itemA = await createCraftItem(prisma, { name: `条目A-${Math.random().toString(36).slice(2, 8)}` })
    const itemB = await createCraftItem(prisma, { name: `条目B-${Math.random().toString(36).slice(2, 8)}` })
    const created = await (await postInheritor(inheritorBody({ craftItemId: itemA.id }))).json()

    const res = await apiFetch(`/api/admin/inheritors/${created.id}`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify(inheritorBody({ craftItemId: itemB.id, level: '省级', bio: '更新后的简介' })),
    })
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated).toMatchObject({ id: created.id, craftItemId: itemB.id, level: '省级', bio: '更新后的简介' })

    const missing = await apiFetch('/api/admin/inheritors/nonexistent-id', {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify(inheritorBody({ craftItemId: itemA.id })),
    })
    expect(missing.status).toBe(404)
  })

  it('删除传承人；不存在 404', async () => {
    const item = await createCraftItem(prisma, { name: `条目-${Math.random().toString(36).slice(2, 8)}` })
    const created = await (await postInheritor(inheritorBody({ craftItemId: item.id }))).json()

    const res = await apiFetch(`/api/admin/inheritors/${created.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(res.status).toBe(200)
    expect(await prisma.inheritor.findUnique({ where: { id: created.id } })).toBeNull()

    const missing = await apiFetch('/api/admin/inheritors/nonexistent-id', {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(missing.status).toBe(404)
  })
})
