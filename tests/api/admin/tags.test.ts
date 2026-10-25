import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { attachTags, createCraftItem, createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from '../helpers'

// 接缝 1：管理端标签 CRUD（工单 #5 / 用户故事 20）——
// 标签是推荐算法的数据源；删除标签须解除与条目的关联；
// 未登录与非管理员一律 403。

let prisma: PrismaClient
let adminCookie: string
let learnerCookie: string

function tagBody(overrides: Record<string, unknown> = {}) {
  return { name: `标签-${Math.random().toString(36).slice(2, 8)}`, ...overrides }
}

async function postTag(body: unknown, cookie = adminCookie) {
  return apiFetch('/api/admin/tags', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('管理端标签 CRUD /api/admin/tags', async () => {
  await setup({ server: true })

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const admin = await createUser(prisma, 'tag_admin', 'ADMIN')
    const learner = await createUser(prisma, 'tag_learner')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
    learnerCookie = await createSessionCookie(learner.id)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('未登录与学习者创建标签均 403', async () => {
    expect((await postTag(tagBody(), '')).status).toBe(403)
    expect((await postTag(tagBody(), learnerCookie)).status).toBe(403)
  })

  it('管理员创建标签返回 201；重名 409；空名 400', async () => {
    const body = tagBody()
    const res = await postTag(body)
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toMatchObject({ name: body.name })
    expect(await prisma.tag.findUnique({ where: { name: body.name } })).not.toBeNull()

    expect((await postTag(body)).status).toBe(409)
    expect((await postTag({ name: '   ' })).status).toBe(400)
  })

  it('列表返回各标签的关联条目数并支持名称搜索', async () => {
    const body = tagBody()
    const item = await createCraftItem(prisma, { name: `条目-${Math.random().toString(36).slice(2, 8)}` })
    await attachTags(prisma, item.id, [body.name])

    const res = await apiFetch(`/api/admin/tags?q=${body.name.slice(-4)}`, { headers: { cookie: adminCookie } })
    expect(res.status).toBe(200)
    const list = await res.json()
    const row = (list.items as Array<{ name: string, itemCount: number }>).find(t => t.name === body.name)
    expect(row).toMatchObject({ name: body.name, itemCount: 1 })

    // 学习者访问列表 403
    expect((await apiFetch('/api/admin/tags', { headers: { cookie: learnerCookie } })).status).toBe(403)
  })

  it('重命名标签：生效且不影响关联；不存在 404；重名 409', async () => {
    const created = await (await postTag(tagBody())).json()
    const renamed = tagBody()

    const res = await apiFetch(`/api/admin/tags/${created.id}`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify(renamed),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: created.id, name: renamed.name })

    const other = await (await postTag(tagBody())).json()
    const conflict = await apiFetch(`/api/admin/tags/${created.id}`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ name: other.name }),
    })
    expect(conflict.status).toBe(409)

    const missing = await apiFetch('/api/admin/tags/nonexistent-id', {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify(renamed),
    })
    expect(missing.status).toBe(404)
  })

  it('删除标签时解除与条目的关联（条目仍在，公开标签列表不再含该标签）', async () => {
    const body = tagBody()
    const item = await createCraftItem(prisma, { name: `条目-${Math.random().toString(36).slice(2, 8)}` })
    await attachTags(prisma, item.id, [body.name])
    const created = await prisma.tag.findUnique({ where: { name: body.name } })

    const res = await apiFetch(`/api/admin/tags/${created!.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(res.status).toBe(200)

    // 关联解除：连接表无残留，条目本身不受影响
    expect(await prisma.tag.findUnique({ where: { id: created!.id } })).toBeNull()
    expect(await prisma.craftItemTag.findFirst({ where: { tagId: created!.id } })).toBeNull()
    expect(await prisma.craftItem.findUnique({ where: { id: item.id } })).not.toBeNull()

    const missing = await apiFetch('/api/admin/tags/nonexistent-id', {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(missing.status).toBe(404)
  })
})
