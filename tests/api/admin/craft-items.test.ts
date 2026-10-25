import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from '../helpers'

// 接缝 1：管理端技艺条目 CRUD（工单 #5 / 用户故事 19-20）——
// 管理员可完成含未发布状态、标签关联与图集数组的完整增删改查；
// 未登录与非管理员一律 403。只断言请求进/响应出 + 数据库状态变。

let prisma: PrismaClient
let adminCookie: string
let learnerCookie: string

async function createTag(name: string) {
  return prisma.tag.create({ data: { name } })
}

/** 合法条目写入体：名称随机以避开唯一约束，字段覆盖 schema 全部必填项 */
function validBody() {
  return {
    name: `测试条目-${Math.random().toString(36).slice(2, 8)}`,
    subcategory: '陶瓷',
    batch: '第一批（2006 年）',
    code: 'Ⅷ-7',
    region: '江西省景德镇市',
    history: '历史渊源正文',
    features: '工艺特色正文',
    images: [{ url: 'https://example.com/a.jpg', credit: 'A, CC BY-SA 4.0' }],
    videoUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    status: 'PUBLISHED',
  }
}

async function postCraftItem(body: unknown, cookie = adminCookie) {
  return apiFetch('/api/admin/craft-items', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('管理端技艺条目 CRUD /api/admin/craft-items', async () => {
  await setup({ server: true })

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const admin = await createUser(prisma, 'craft_admin', 'ADMIN')
    const learner = await createUser(prisma, 'craft_learner')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
    learnerCookie = await createSessionCookie(learner.id)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('未登录与学习者创建条目均 403', async () => {
    expect((await postCraftItem(validBody(), '')).status).toBe(403)
    expect((await postCraftItem(validBody(), learnerCookie)).status).toBe(403)
  })

  it('管理员创建条目（含标签关联与图集）返回 201 与完整字段，标签关联落库', async () => {
    const tagA = await createTag(`标签A-${Math.random().toString(36).slice(2, 6)}`)
    const tagB = await createTag(`标签B-${Math.random().toString(36).slice(2, 6)}`)
    const body = validBody()
    const res = await postCraftItem({ ...body, tagIds: [tagA.id, tagB.id] })
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toMatchObject({
      name: body.name,
      subcategory: '陶瓷',
      batch: '第一批（2006 年）',
      code: 'Ⅷ-7',
      region: '江西省景德镇市',
      history: '历史渊源正文',
      features: '工艺特色正文',
      images: [{ url: 'https://example.com/a.jpg', credit: 'A, CC BY-SA 4.0' }],
      videoUrl: body.videoUrl,
      status: 'PUBLISHED',
    })
    expect([...created.tagIds].sort()).toEqual([tagA.id, tagB.id].sort())

    const dbRow = await prisma.craftItem.findUnique({
      where: { name: body.name },
      include: { tags: true },
    })
    expect(dbRow?.tags.map(t => t.tagId).sort()).toEqual([tagA.id, tagB.id].sort())
  })

  it('创建时名称与既有条目重复返回 409', async () => {
    const body = validBody()
    expect((await postCraftItem(body)).status).toBe(201)
    const res = await postCraftItem({ ...body, code: 'Ⅷ-999' })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error?: string }).error).toBeTruthy()
  })

  it('创建时包含不存在的标签 ID 返回 400', async () => {
    const res = await postCraftItem({ ...validBody(), tagIds: ['nonexistent-tag-id'] })
    expect(res.status).toBe(400)
  })

  it('创建时缺少必填字段返回 400', async () => {
    const { name: _omitted, ...missingName } = validBody()
    expect((await postCraftItem(missingName)).status).toBe(400)

    const blankRegion = { ...validBody(), region: '   ' }
    expect((await postCraftItem(blankRegion)).status).toBe(400)
  })

  it('管理列表含未发布条目，支持状态/子类别筛选与名称搜索', async () => {
    const published = validBody()
    const draft = { ...validBody(), subcategory: '织绣', status: 'DRAFT' }
    await postCraftItem(published)
    await postCraftItem(draft)

    const listHeader = { cookie: adminCookie }
    const all = await apiFetch('/api/admin/craft-items', { headers: listHeader })
    expect(all.status).toBe(200)
    const allBody = await all.json()
    expect(allBody.items.map((item: { name: string }) => item.name)).toEqual(
      expect.arrayContaining([published.name, draft.name]),
    )

    const drafts = await (await apiFetch('/api/admin/craft-items?status=DRAFT', { headers: listHeader })).json()
    expect(drafts.items.map((item: { name: string }) => item.name)).toContain(draft.name)
    expect(drafts.items.map((item: { name: string }) => item.name)).not.toContain(published.name)

    const ceramics = await (await apiFetch('/api/admin/craft-items?subcategory=陶瓷', { headers: listHeader })).json()
    expect(ceramics.items.map((item: { name: string }) => item.name)).toContain(published.name)
    expect(ceramics.items.map((item: { name: string }) => item.name)).not.toContain(draft.name)

    const keyword = published.name.slice(-4)
    const searched = await (await apiFetch(`/api/admin/craft-items?q=${keyword}`, { headers: listHeader })).json()
    expect(searched.items.map((item: { name: string }) => item.name)).toContain(published.name)

    // 学习者访问管理列表同样 403
    const learnerRes = await apiFetch('/api/admin/craft-items', { headers: { cookie: learnerCookie } })
    expect(learnerRes.status).toBe(403)
  })

  it('条目详情（编辑用）返回 tagIds；不存在的 ID 返回 404', async () => {
    const tag = await createTag(`详情标签-${Math.random().toString(36).slice(2, 6)}`)
    const body = validBody()
    const created = await (await postCraftItem({ ...body, tagIds: [tag.id] })).json()

    const detail = await apiFetch(`/api/admin/craft-items/${created.id}`, { headers: { cookie: adminCookie } })
    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({
      id: created.id,
      name: body.name,
      status: 'PUBLISHED',
      tagIds: [tag.id],
    })

    const missing = await apiFetch('/api/admin/craft-items/nonexistent-id', { headers: { cookie: adminCookie } })
    expect(missing.status).toBe(404)
  })

  it('更新条目：字段生效且标签关联整体替换；不存在返回 404，名称冲突返回 409', async () => {
    const tagOld = await createTag(`旧标签-${Math.random().toString(36).slice(2, 6)}`)
    const tagNew = await createTag(`新标签-${Math.random().toString(36).slice(2, 6)}`)
    const created = await (await postCraftItem({ ...validBody(), tagIds: [tagOld.id] })).json()

    const replacement = validBody()
    const res = await apiFetch(`/api/admin/craft-items/${created.id}`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...replacement, status: 'DRAFT', tagIds: [tagNew.id] }),
    })
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated).toMatchObject({ id: created.id, name: replacement.name, status: 'DRAFT', tagIds: [tagNew.id] })

    const dbRow = await prisma.craftItem.findUnique({ where: { id: created.id }, include: { tags: true } })
    expect(dbRow?.tags.map(t => t.tagId)).toEqual([tagNew.id])

    // 名称与其他条目冲突 → 409
    const conflict = await apiFetch(`/api/admin/craft-items/${created.id}`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...replacement, name: replacement.name }),
    })
    // 与自身同名不算冲突（允许不改名提交）
    expect(conflict.status).toBe(200)

    const other = await (await postCraftItem(validBody())).json()
    const conflictWithOther = await apiFetch(`/api/admin/craft-items/${created.id}`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...replacement, name: other.name }),
    })
    expect(conflictWithOther.status).toBe(409)

    // 不存在的条目 → 404
    const missing = await apiFetch('/api/admin/craft-items/nonexistent-id', {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify(replacement),
    })
    expect(missing.status).toBe(404)
  })

  it('删除条目后列表与详情均不可见，级联解除标签关联；不存在返回 404', async () => {
    const tag = await createTag(`待解除-${Math.random().toString(36).slice(2, 6)}`)
    const created = await (await postCraftItem({ ...validBody(), tagIds: [tag.id] })).json()

    const res = await apiFetch(`/api/admin/craft-items/${created.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(res.status).toBe(200)

    expect(await prisma.craftItem.findUnique({ where: { id: created.id } })).toBeNull()
    expect(await prisma.craftItemTag.findFirst({ where: { tagId: tag.id } })).toBeNull()

    const detail = await apiFetch(`/api/admin/craft-items/${created.id}`, { headers: { cookie: adminCookie } })
    expect(detail.status).toBe(404)

    const missing = await apiFetch('/api/admin/craft-items/nonexistent-id', {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(missing.status).toBe(404)
  })
})
