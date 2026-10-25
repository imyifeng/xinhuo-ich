import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from '@node-rs/argon2'
import { PrismaClient } from '../server/generated/prisma/client'
import './load-env'
import { SEED_CRAFT_ITEMS } from './seed-data'
import { SEED_COURSES } from './seed-courses'

// 种子脚本：幂等（按名称 upsert），可重复执行。
// 技艺条目按 name upsert；标签按 name upsert；传承人按（条目, 姓名）upsert；
// 课程按（标题, 作者）upsert，已存在时重建步骤；演示账号按 username upsert（存在则不动）。

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

/**
 * 演示管理员账号（工单 #5）：管理后台 /admin 需要管理员登录态，
 * 注册接口只能造学习者，故由种子幂等 upsert 一个管理员（按用户名，存在则不动）。
 * 仅用于开发/演示，生产库默认为空。
 */
async function seedAdminUser() {
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      displayName: '平台管理员',
      passwordHash: await hash('admin12345'),
      role: 'ADMIN',
    },
    update: {},
  })
}

/**
 * 演示传承人账号（工单 #6）：课程的作者；凭据见 README（inheritor / inheritor12345）。
 * 仅用于开发/演示，生产库默认为空。
 */
async function seedInheritorUser(): Promise<{ id: number }> {
  return prisma.user.upsert({
    where: { username: 'inheritor' },
    create: {
      username: 'inheritor',
      displayName: '演示传承人',
      passwordHash: await hash('inheritor12345'),
      role: 'INHERITOR',
    },
    update: {},
  })
}

/**
 * 演示课程（工单 #6）：为 5 个不同子类别的条目各配一门已发布课程（4~6 步）。
 * 按（标题, 作者）幂等：已存在则更新简介/状态并整体重建步骤，保证重复执行结果一致。
 */
async function seedCourses(authorId: number) {
  for (const course of SEED_COURSES) {
    const craftItem = await prisma.craftItem.findUnique({ where: { name: course.craftItemName }, select: { id: true } })
    if (!craftItem) {
      throw new Error(`[seed] 课程挂载的条目不存在：${course.craftItemName}`)
    }

    const existing = await prisma.course.findFirst({
      where: { title: course.title, authorId },
      select: { id: true },
    })

    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          intro: course.intro,
          craftItemId: craftItem.id,
          status: 'PUBLISHED',
          rejectReason: null,
          steps: { deleteMany: {} },
        },
      })
      for (const [index, step] of course.steps.entries()) {
        await prisma.step.create({
          data: { courseId: existing.id, order: index + 1, title: step.title, content: step.content },
        })
      }
    }
    else {
      await prisma.course.create({
        data: {
          title: course.title,
          intro: course.intro,
          craftItemId: craftItem.id,
          authorId,
          status: 'PUBLISHED',
          steps: {
            create: course.steps.map((step, index) => ({
              order: index + 1,
              title: step.title,
              content: step.content,
            })),
          },
        },
      })
    }
  }
}

async function main() {
  await seedCraftItems()
  const inheritor = await seedInheritorUser()
  await seedCourses(inheritor.id)
  await seedAdminUser()
  const [craftItems, tags, inheritors, courses, steps] = await Promise.all([
    prisma.craftItem.count(),
    prisma.tag.count(),
    prisma.inheritor.count(),
    prisma.course.count(),
    prisma.step.count(),
  ])
  console.log(`[seed] 技艺条目 ${craftItems} 条、标签 ${tags} 个、传承人 ${inheritors} 位、课程 ${courses} 门（步骤 ${steps} 个）、演示账号 admin 与 inheritor（幂等 upsert 完成）`)
}

main()
  .catch((err) => {
    console.error('[seed] 失败：', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
