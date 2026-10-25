import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from '../helpers'

// 接缝 1：管理端账号列表与角色标记（工单 #5 / 用户故事 22）——
// 管理员查看账号列表（分页/搜索/角色筛选）并把学习者标记为传承人或管理员；
// 角色以数据库为准：被标记为管理员后，既有会话即可访问管理端（角色查库，规格 #1）。

let prisma: PrismaClient
let adminCookie: string
let learnerCookie: string

describe('管理端账号管理 /api/admin/users', async () => {
  await setup({ server: true })

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const admin = await createUser(prisma, 'users_admin', 'ADMIN')
    const learner = await createUser(prisma, 'users_learner')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
    learnerCookie = await createSessionCookie(learner.id)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('未登录修改角色 403；学习者访问账号列表 403', async () => {
    const target = await createUser(prisma)
    const put = await apiFetch(`/api/admin/users/${target.id}/role`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'INHERITOR' }),
    })
    expect(put.status).toBe(403)

    const list = await apiFetch('/api/admin/users', { headers: { cookie: learnerCookie } })
    expect(list.status).toBe(403)
  })

  it('账号列表：分页、名称/用户名搜索与角色筛选', async () => {
    await createUser(prisma, 'list_learner_甲')
    await createUser(prisma, 'list_learner_乙')
    await createUser(prisma, 'list_inheritor_丙', 'INHERITOR')

    const listHeader = { cookie: adminCookie }
    const all = await (await apiFetch('/api/admin/users', { headers: listHeader })).json()
    expect(all.total).toBeGreaterThanOrEqual(4)
    expect(all.items[0]).toMatchObject({ username: expect.any(String), role: expect.any(String) })
    // passwordHash 永不出库
    expect(JSON.stringify(all.items)).not.toContain('passwordHash')

    const searched = await (await apiFetch('/api/admin/users?q=list_learner_甲', { headers: listHeader })).json()
    expect(searched.items).toHaveLength(1)
    expect(searched.items[0].username).toBe('list_learner_甲')

    const inheritors = await (await apiFetch('/api/admin/users?role=INHERITOR', { headers: listHeader })).json()
    expect(inheritors.total).toBe(1)
    expect(inheritors.items[0].username).toBe('list_inheritor_丙')

    const paged = await (await apiFetch('/api/admin/users?page=1&pageSize=2', { headers: listHeader })).json()
    expect(paged.items).toHaveLength(2)
    expect(paged.page).toBe(1)
    expect(paged.pageSize).toBe(2)
  })

  it('角色标记：学习者 → 传承人落库并返回公开用户信息', async () => {
    const target = await createUser(prisma, 'mark_target')
    const res = await apiFetch(`/api/admin/users/${target.id}/role`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'INHERITOR' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: target.id, username: 'mark_target', role: 'INHERITOR' })
    expect((await prisma.user.findUnique({ where: { id: target.id } }))?.role).toBe('INHERITOR')
  })

  it('角色不合法返回 400；用户不存在返回 404', async () => {
    const target = await createUser(prisma)
    const badRole = await apiFetch(`/api/admin/users/${target.id}/role`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'SUPERUSER' }),
    })
    expect(badRole.status).toBe(400)

    const missing = await apiFetch('/api/admin/users/999999/role', {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'LEARNER' }),
    })
    expect(missing.status).toBe(404)
  })

  it('角色标记即时生效：学习者被标记为管理员后，既有会话即可访问管理端（角色查库）', async () => {
    const target = await createUser(prisma, 'promoted_admin')
    const targetCookie = await createSessionCookie(target.id)
    expect((await apiFetch('/api/admin/users', { headers: { cookie: targetCookie } })).status).toBe(403)

    const res = await apiFetch(`/api/admin/users/${target.id}/role`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    })
    expect(res.status).toBe(200)

    // 同一（标记前签发的）会话现在可以访问管理端
    const after = await apiFetch('/api/admin/users', { headers: { cookie: targetCookie } })
    expect(after.status).toBe(200)
  })
})
