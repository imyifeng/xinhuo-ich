import './load-env'
import { usePrisma } from '../server/utils/prisma'
import { runContentSeed } from './seed-content'

// 内容种子脚本（db:seed）：写入技艺条目、标签、传承人、课程、演示账号与交流区帖子。
// 幂等约定见 seed-content.ts（按名称/标题 upsert，可重复执行）。
// 演示行为数据（行为事件 + 画像重建）走 demo:seed（prisma/demo-seed.ts）。

async function main() {
  const { createdPosts } = await runContentSeed()
  const prisma = usePrisma()
  const [craftItems, tags, inheritors, courses, steps, posts, comments] = await Promise.all([
    prisma.craftItem.count(),
    prisma.tag.count(),
    prisma.inheritor.count(),
    prisma.course.count(),
    prisma.step.count(),
    prisma.post.count(),
    prisma.comment.count(),
  ])
  console.log(`[seed] 技艺条目 ${craftItems} 条、标签 ${tags} 个、传承人 ${inheritors} 位、课程 ${courses} 门（步骤 ${steps} 个）、交流区帖子 ${posts} 条（本次新增 ${createdPosts}）、评论 ${comments} 条、演示账号 admin 与 inheritor（幂等 upsert 完成）`)
}

main()
  .catch((err) => {
    console.error('[seed] 失败：', err)
    process.exitCode = 1
  })
  .finally(() => usePrisma().$disconnect())
