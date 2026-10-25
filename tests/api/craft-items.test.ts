import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { createCraftItem, resetCraftItemTables } from './helpers'

// 接缝 1：技艺条目列表/详情 —— 真实 Nitro 服务 + 测试库，只断言请求进/响应出的外部行为
describe('GET /api/craft-items', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  beforeAll(() => {
    // globalSetup 已把 DATABASE_URL 指向测试库
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  })

  it('空库时返回空列表与零总数', async () => {
    await resetCraftItemTables(prisma)
    const body = await $fetch('/api/craft-items')
    expect(body).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
      subcategories: [],
    })
  })

  it('仅返回已发布条目并附带子类别清单', async () => {
    await resetCraftItemTables(prisma)
    await createCraftItem(prisma, { name: '甲', subcategory: '陶瓷', images: [{ url: 'https://example.com/a.jpg', credit: 'A, CC BY-SA 4.0' }] })
    await createCraftItem(prisma, { name: '乙', subcategory: '织绣' })
    await createCraftItem(prisma, { name: '草稿条目', subcategory: '陶瓷', status: 'DRAFT' })

    const body = await $fetch('/api/craft-items')
    expect(body.total).toBe(2)
    expect(body.items.map((item: { name: string }) => item.name).sort()).toEqual(['乙', '甲'])
    expect(body.subcategories.sort()).toEqual(['织绣', '陶瓷'])

    const first = body.items.find((item: { name: string }) => item.name === '甲')
    expect(first).toMatchObject({
      name: '甲',
      subcategory: '陶瓷',
      region: '江西省',
      batch: '第一批（2006 年）',
      code: 'Ⅷ-7',
      images: [{ url: 'https://example.com/a.jpg', credit: 'A, CC BY-SA 4.0' }],
      tags: [],
    })
  })

  it('按子类别筛选：仅返回该子类别的已发布条目', async () => {
    await resetCraftItemTables(prisma)
    await createCraftItem(prisma, { name: '甲', subcategory: '陶瓷' })
    await createCraftItem(prisma, { name: '乙', subcategory: '陶瓷' })
    await createCraftItem(prisma, { name: '丙', subcategory: '织绣' })

    const body = await $fetch('/api/craft-items?subcategory=陶瓷')
    expect(body.total).toBe(2)
    expect(body.items.map((item: { name: string }) => item.name).sort()).toEqual(['乙', '甲'])
    // 筛选不影响子类别清单（前端筛选芯片仍需全量）
    expect(body.subcategories.sort()).toEqual(['织绣', '陶瓷'])
  })

  it('筛选无匹配子类别时返回空列表', async () => {
    await resetCraftItemTables(prisma)
    await createCraftItem(prisma, { name: '甲', subcategory: '陶瓷' })

    const body = await $fetch('/api/craft-items?subcategory=不存在的类别')
    expect(body).toMatchObject({ items: [], total: 0 })
  })

  it('分页：pageSize 与 page 生效，总数不随分页变化', async () => {
    await resetCraftItemTables(prisma)
    await createCraftItem(prisma, { name: '甲', subcategory: '陶瓷' })
    await createCraftItem(prisma, { name: '乙', subcategory: '陶瓷' })
    await createCraftItem(prisma, { name: '丙', subcategory: '陶瓷' })

    const page1 = await $fetch('/api/craft-items?pageSize=2&page=1')
    expect(page1.total).toBe(3)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(2)
    expect(page1.items).toHaveLength(2)

    const page2 = await $fetch('/api/craft-items?pageSize=2&page=2')
    expect(page2.items).toHaveLength(1)
    // 两页不重叠
    const names1 = page1.items.map((item: { name: string }) => item.name)
    const names2 = page2.items.map((item: { name: string }) => item.name)
    expect([...names1, ...names2].sort()).toEqual(['丙', '乙', '甲'])
  })

  it('非法分页参数回退到安全范围（page 从 1 起，pageSize 上限 50）', async () => {
    await resetCraftItemTables(prisma)
    await createCraftItem(prisma, { name: '甲', subcategory: '陶瓷' })

    const zeroPage = await $fetch('/api/craft-items?page=0')
    expect(zeroPage.page).toBe(1)

    const hugePageSize = await $fetch('/api/craft-items?pageSize=9999')
    expect(hugePageSize.pageSize).toBe(50)

    const nanPage = await $fetch('/api/craft-items?page=abc')
    expect(nanPage.page).toBe(1)
  })
})
