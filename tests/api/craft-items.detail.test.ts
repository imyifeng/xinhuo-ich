import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../server/generated/prisma/client'
import { attachTags, createCraftItem, resetCraftItemTables } from './helpers'

// 接缝 1：技艺条目详情 —— 存在且已发布返回完整展示字段（含传承人与标签），否则 404
describe('GET /api/craft-items/:id', async () => {
  await setup({ server: true })

  let prisma: PrismaClient
  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  })

  it('返回详情：展示字段、传承人与标签齐全', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, {
      name: '测试条目甲',
      history: '始于宋，盛于明清。',
      features: '白如玉，明如镜。',
      images: [{ url: 'https://example.com/1.jpg', credit: '张三, CC BY-SA 4.0' }],
      videoUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    })
    await attachTags(prisma, item.id, ['瓷器', '手作'])
    await prisma.inheritor.create({
      data: { name: '李传承', level: '国家级', bio: '从事该技艺五十年。', craftItemId: item.id },
    })

    const body = await $fetch(`/api/craft-items/${item.id}`)
    expect(body).toMatchObject({
      id: item.id,
      name: '测试条目甲',
      subcategory: '陶瓷',
      batch: '第一批（2006 年）',
      code: 'Ⅷ-7',
      region: '江西省',
      history: '始于宋，盛于明清。',
      features: '白如玉，明如镜。',
      images: [{ url: 'https://example.com/1.jpg', credit: '张三, CC BY-SA 4.0' }],
      videoUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
      tags: expect.arrayContaining(['瓷器', '手作']),
      inheritors: [
        { name: '李传承', level: '国家级', bio: '从事该技艺五十年。' },
      ],
    })
  })

  it('不存在的 ID 返回 404', async () => {
    const res = await fetch("/api/craft-items/does-not-exist")
    expect(res.status).toBe(404)
  })

  it('未发布（草稿）条目对游客返回 404', async () => {
    await resetCraftItemTables(prisma)
    const item = await createCraftItem(prisma, { name: '草稿条目', status: 'DRAFT' })

    const res = await fetch(`/api/craft-items/${item.id}`)
    expect(res.status).toBe(404)
  })
})
