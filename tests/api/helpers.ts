import type { PrismaClient } from '../../server/generated/prisma/client'

/** 测试夹具工厂：条目默认字段随 schema 演进，仅暴露测试关心的覆盖项 */
export async function createCraftItem(
  prisma: PrismaClient,
  overrides: Partial<{ name: string, subcategory: string, region: string, batch: string, code: string, history: string, features: string, images: unknown, videoUrl: string | null, status: 'DRAFT' | 'PUBLISHED' }> = {},
) {
  return prisma.craftItem.create({
    data: {
      name: overrides.name ?? `测试条目-${Math.random().toString(36).slice(2)}`,
      subcategory: overrides.subcategory ?? '陶瓷',
      region: overrides.region ?? '江西省',
      batch: overrides.batch ?? '第一批（2006 年）',
      code: overrides.code ?? 'Ⅷ-7',
      history: overrides.history ?? '历史渊源',
      features: overrides.features ?? '工艺特色',
      images: (overrides.images ?? []) as object,
      videoUrl: overrides.videoUrl ?? null,
      status: overrides.status ?? 'PUBLISHED',
    },
  })
}

/** 给条目挂标签（不存在则创建），返回标签名列表 */
export async function attachTags(prisma: PrismaClient, craftItemId: string, tagNames: string[]) {
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({ where: { name }, create: { name }, update: {} })
    await prisma.craftItemTag.create({ data: { craftItemId, tagId: tag.id } })
  }
}

/** 清空条目相关表（级联含传承人/条目标签） */
export async function resetCraftItemTables(prisma: PrismaClient) {
  await prisma.behaviorEvent.deleteMany()
  await prisma.user.deleteMany()
  await prisma.craftItemTag.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.inheritor.deleteMany()
  await prisma.craftItem.deleteMany()
}
