import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as apiFetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../server/generated/prisma/client'
import { attachTags, createCraftItem, createSessionCookie, createUser, disconnectFixtureRedis, resetCraftItemTables } from '../helpers'

// 接缝 1：管理端间接变更的缓存失效（规格偏差 3）——
// 条目详情缓存以条目 ID 为键，但标签名与传承人信息是详情内容的一部分：
// 管理端改标签（重命名/删除）或改传承人（更新/改挂/删除）后，
// 受影响条目的详情缓存必须被逐个失效，下次请求 X-Cache: MISS 且返回新值。
describe('管理端改标签/传承人后的条目详情缓存失效', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  let adminCookie: string

  function jsonHeaders() {
    return { cookie: adminCookie, 'content-type': 'application/json' }
  }

  /** 预热条目详情缓存：冷 MISS → 热 HIT，返回热身响应体 */
  async function warmCache(itemId: string) {
    const cold = await fetch(`/api/craft-items/${itemId}`)
    expect(cold.headers.get('x-cache')).toBe('MISS')
    const warm = await fetch(`/api/craft-items/${itemId}`)
    expect(warm.headers.get('x-cache')).toBe('HIT')
    return await warm.json()
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
    await resetCraftItemTables(prisma)
    const admin = await createUser(prisma, 'cache_admin', 'ADMIN')
    adminCookie = await createSessionCookie(admin.id, 'ADMIN')
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await disconnectFixtureRedis()
  })

  it('重命名标签：关联条目详情缓存失效，下次请求 MISS 且返回新标签名', async () => {
    const oldName = `旧标签-${Math.random().toString(36).slice(2, 8)}`
    const newName = `新标签-${Math.random().toString(36).slice(2, 8)}`
    const item = await createCraftItem(prisma, { name: `标签改名条目-${Math.random().toString(36).slice(2, 8)}` })
    await attachTags(prisma, item.id, [oldName])
    const tag = await prisma.tag.findUniqueOrThrow({ where: { name: oldName } })

    expect((await warmCache(item.id)).tags).toContain(oldName)

    const res = await apiFetch(`/api/admin/tags/${tag.id}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: newName }),
    })
    expect(res.status).toBe(200)

    const rebuilt = await fetch(`/api/craft-items/${item.id}`)
    expect(rebuilt.headers.get('x-cache')).toBe('MISS')
    const body = await rebuilt.json()
    expect(body.tags).toContain(newName)
    expect(body.tags).not.toContain(oldName)
  })

  it('删除标签：关联条目详情缓存失效，下次请求 MISS 且不再含该标签', async () => {
    const name = `待删标签-${Math.random().toString(36).slice(2, 8)}`
    const item = await createCraftItem(prisma, { name: `标签删除条目-${Math.random().toString(36).slice(2, 8)}` })
    await attachTags(prisma, item.id, [name])
    const tag = await prisma.tag.findUniqueOrThrow({ where: { name } })

    expect((await warmCache(item.id)).tags).toContain(name)

    const res = await apiFetch(`/api/admin/tags/${tag.id}`, { method: 'DELETE', headers: jsonHeaders() })
    expect(res.status).toBe(200)

    const rebuilt = await fetch(`/api/craft-items/${item.id}`)
    expect(rebuilt.headers.get('x-cache')).toBe('MISS')
    expect((await rebuilt.json()).tags).not.toContain(name)
  })

  it('更新传承人（改名）：所属条目详情缓存失效，下次请求 MISS 且返回新姓名', async () => {
    const item = await createCraftItem(prisma, { name: `传承人改名条目-${Math.random().toString(36).slice(2, 8)}` })
    const created = await (await apiFetch('/api/admin/inheritors', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: '张三', level: '国家级', bio: '代表性传承人', craftItemId: item.id }),
    })).json()

    expect((await warmCache(item.id)).inheritors.map((i: { name: string }) => i.name)).toContain('张三')

    const res = await apiFetch(`/api/admin/inheritors/${created.id}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: '张小三', level: '国家级', bio: '代表性传承人', craftItemId: item.id }),
    })
    expect(res.status).toBe(200)

    const rebuilt = await fetch(`/api/craft-items/${item.id}`)
    expect(rebuilt.headers.get('x-cache')).toBe('MISS')
    expect((await rebuilt.json()).inheritors.map((i: { name: string }) => i.name)).toContain('张小三')
  })

  it('传承人改挂条目：新旧两个条目的详情缓存都失效', async () => {
    const itemA = await createCraftItem(prisma, { name: `改挂条目甲-${Math.random().toString(36).slice(2, 8)}` })
    const itemB = await createCraftItem(prisma, { name: `改挂条目乙-${Math.random().toString(36).slice(2, 8)}` })
    const created = await (await apiFetch('/api/admin/inheritors', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: '李四', level: '省级', bio: '代表性传承人', craftItemId: itemA.id }),
    })).json()

    expect((await warmCache(itemA.id)).inheritors.map((i: { name: string }) => i.name)).toContain('李四')
    expect((await warmCache(itemB.id)).inheritors).toHaveLength(0)

    const res = await apiFetch(`/api/admin/inheritors/${created.id}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: '李四', level: '省级', bio: '代表性传承人', craftItemId: itemB.id }),
    })
    expect(res.status).toBe(200)

    const rebuiltA = await fetch(`/api/craft-items/${itemA.id}`)
    expect(rebuiltA.headers.get('x-cache')).toBe('MISS')
    expect((await rebuiltA.json()).inheritors).toHaveLength(0)

    const rebuiltB = await fetch(`/api/craft-items/${itemB.id}`)
    expect(rebuiltB.headers.get('x-cache')).toBe('MISS')
    expect((await rebuiltB.json()).inheritors.map((i: { name: string }) => i.name)).toContain('李四')
  })

  it('删除传承人：所属条目详情缓存失效，下次请求 MISS 且传承人为空', async () => {
    const item = await createCraftItem(prisma, { name: `传承人删除条目-${Math.random().toString(36).slice(2, 8)}` })
    const created = await (await apiFetch('/api/admin/inheritors', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: '王五', level: '国家级', bio: '代表性传承人', craftItemId: item.id }),
    })).json()

    expect((await warmCache(item.id)).inheritors).toHaveLength(1)

    const res = await apiFetch(`/api/admin/inheritors/${created.id}`, { method: 'DELETE', headers: jsonHeaders() })
    expect(res.status).toBe(200)

    const rebuilt = await fetch(`/api/craft-items/${item.id}`)
    expect(rebuilt.headers.get('x-cache')).toBe('MISS')
    expect((await rebuilt.json()).inheritors).toHaveLength(0)
  })
})
