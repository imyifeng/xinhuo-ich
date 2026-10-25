import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../server/generated/prisma/client'
import './load-env'
import { SEED_CRAFT_ITEMS } from './seed-data'

// 种子脚本：幂等（按名称 upsert），可重复执行。
// 技艺条目按 name upsert；标签按 name upsert；传承人按（条目, 姓名）upsert。

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function seedCraftItems() {
  for (const item of SEED_CRAFT_ITEMS) {
    const craftItem = await prisma.craftItem.upsert({
      where: { name: item.name },
      create: {
        name: item.name,
        subcategory: item.subcategory,
        batch: item.batch,
        code: item.code,
        region: item.region,
        history: item.history,
        features: item.features,
        images: item.images,
        videoUrl: item.videoUrl,
        status: 'PUBLISHED',
      },
      update: {
        subcategory: item.subcategory,
        batch: item.batch,
        code: item.code,
        region: item.region,
        history: item.history,
        features: item.features,
        images: item.images,
        videoUrl: item.videoUrl,
      },
    })

    for (const tag of item.tags) {
      const row = await prisma.tag.upsert({ where: { name: tag }, create: { name: tag }, update: {} })
      await prisma.craftItemTag.upsert({
        where: { craftItemId_tagId: { craftItemId: craftItem.id, tagId: row.id } },
        create: { craftItemId: craftItem.id, tagId: row.id },
        update: {},
      })
    }

    for (const inheritor of item.inheritors) {
      await prisma.inheritor.upsert({
        where: { craftItemId_name: { craftItemId: craftItem.id, name: inheritor.name } },
        create: {
          name: inheritor.name,
          level: inheritor.level,
          bio: inheritor.bio,
          craftItemId: craftItem.id,
        },
        update: {
          level: inheritor.level,
          bio: inheritor.bio,
        },
      })
    }
  }
}

async function main() {
  await seedCraftItems()
  const [craftItems, tags, inheritors] = await Promise.all([
    prisma.craftItem.count(),
    prisma.tag.count(),
    prisma.inheritor.count(),
  ])
  console.log(`[seed] 技艺条目 ${craftItems} 条、标签 ${tags} 个、传承人 ${inheritors} 位（幂等 upsert 完成）`)
}

main()
  .catch((err) => {
    console.error('[seed] 失败：', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
