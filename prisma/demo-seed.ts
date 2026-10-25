import { hash } from '@node-rs/argon2'
import './load-env'
import { usePrisma } from '../server/utils/prisma'
import { rebuildProfilesAndRecommendations } from '../server/utils/services/recommendation.service'
import { runContentSeed } from './seed-content'

/**
 * 演示数据管道（工单 #10，demo:seed）：让生产库开箱即有完整演示效果。
 *
 * 链路：内容种子（与 db:seed 共用 runContentSeed，幂等）→ 补充演示学习者账号 →
 * 合成五类行为事件（近两周、每人几十条、偏好差异化）→ 调用画像重建入口
 * （与管理员手动触发/每日 cron 同一条管道）→ 画像与推荐落库非空。
 *
 * 幂等策略——对演示学习者「先清后造」：
 * 每次执行先删除演示学习者的全部 behavior_event 与 learning_record，再按确定性
 * 伪随机序列（固定种子）整体重建。账号与内容仍走 upsert。选定先清后造而非按键去重，
 * 是因为 behavior_event 无业务唯一键，先清后造是唯一保证「重复跑不翻倍」的可靠做法；
 * 代价是演示账号在两次执行之间产生的真实行为会被覆盖——演示数据以脚本为准（下方注明）。
 */

/** 合成行为事件的时间窗（规格要求近两周） */
const DEMO_WINDOW_DAYS = 14

/**
 * 演示学习者画像：username 对应演示账号，prefer 为主要浏览/学习的子类别。
 * 每个子类别两名学习者（同好成簇），让 K-Means 能按子类别聚出画像标签各异的簇，
 * /admin/profiles 的簇分布与「同好都在看」的推荐理由才有演示说服力。
 */
const DEMO_PERSONAS = [
  { username: 'taotao', prefer: '陶瓷' },
  { username: 'yaoyao', prefer: '陶瓷' },
  { username: 'shanshan', prefer: '织绣' },
  { username: 'xiuxiu', prefer: '织绣' },
  { username: 'muzi', prefer: '造纸印刷' },
  { username: 'momo', prefer: '造纸印刷' },
  { username: 'jiujiu', prefer: '酿造' },
  { username: 'ququ', prefer: '酿造' },
  { username: 'xiaotie', prefer: '金属加工' },
  { username: 'dingding', prefer: '金属加工' },
] as const

/** 内容种子之外的补充演示学习者（taotao/shanshan/muzi 由内容种子创建） */
const EXTRA_LEARNERS = [
  { username: 'jiujiu', displayName: '酒酒问酿', password: 'jiujiu123456' },
  { username: 'ququ', displayName: '曲曲探酿', password: 'ququ123456' },
  { username: 'yaoyao', displayName: '窑窑观瓷', password: 'yaoyao123456' },
  { username: 'xiuxiu', displayName: '绣绣弄针', password: 'xiuxiu123456' },
  { username: 'momo', displayName: '墨墨印话', password: 'momo123456' },
  { username: 'xiaotie', displayName: '小铁学锻', password: 'xiaotie123456' },
  { username: 'dingding', displayName: '叮叮锻铁', password: 'dingding123456' },
] as const

/** 确定性伪随机（mulberry32）：同种子同序列，保证重复执行生成一致的事件分布 */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 补充演示学习者账号（幂等 upsert，存在则不动） */
async function seedExtraLearners() {
  const prisma = usePrisma()
  for (const learner of EXTRA_LEARNERS) {
    await prisma.user.upsert({
      where: { username: learner.username },
      create: {
        username: learner.username,
        displayName: learner.displayName,
        passwordHash: await hash(learner.password),
        role: 'LEARNER',
      },
      update: {},
    })
  }
}

/** 单个学习者的合成事件草稿（createdAt 统一在落库前计算） */
interface SynthesizedEvent {
  userId: number
  type: 'VIEW_ITEM' | 'START_COURSE' | 'COMPLETE_STEP' | 'CREATE_POST' | 'CREATE_COMMENT'
  targetType: string
  targetId: string
  createdAt: Date
}

/**
 * 合成五类行为事件与配套学习记录（先清后造）。
 * 偏好差异化：每位学习者约七成浏览落在偏好子类别的条目上，并完整学完偏好子类别的课程；
 * 另以少量跨类浏览/试学模拟真实混合兴趣，让 K-Means 能聚出以子类别命名画像标签的簇。
 */
async function synthesizeBehavior(): Promise<{ eventCount: number, recordCount: number }> {
  const prisma = usePrisma()

  const personas = await Promise.all(DEMO_PERSONAS.map(async (persona) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: persona.username },
      select: { id: true, username: true },
    })
    return { ...persona, userId: user.id }
  }))

  const [items, courses, posts] = await Promise.all([
    prisma.craftItem.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, subcategory: true },
      orderBy: { id: 'asc' },
    }),
    prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, steps: { orderBy: { order: 'asc' }, select: { id: true } }, craftItem: { select: { subcategory: true } } },
      orderBy: { id: 'asc' },
    }),
    prisma.post.findMany({
      where: { author: { username: { in: [...new Set(DEMO_PERSONAS.map(p => p.username))] } } },
      select: { id: true, authorId: true, createdAt: true, comments: { select: { id: true, authorId: true, createdAt: true } } },
    }),
  ])

  // ---- 先清：演示学习者的行为事件与学习记录整体移除（帖子/评论正文不受影响）----
  const demoUserIds = personas.map(p => p.userId)
  await prisma.behaviorEvent.deleteMany({ where: { userId: { in: demoUserIds } } })
  await prisma.learningRecord.deleteMany({ where: { userId: { in: demoUserIds } } })

  const rand = mulberry32(20260426)
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const events: SynthesizedEvent[] = []
  const learningRecords: Array<{ userId: number, stepId: string, completedAt: Date }> = []

  personas.forEach((persona) => {
    const preferredItems = items.filter(item => item.subcategory === persona.prefer)
    if (preferredItems.length === 0) {
      throw new Error(`[demo-seed] 子类别无已发布条目，无法合成偏好：${persona.prefer}`)
    }
    // 跨类兴趣：非偏好条目按确定性间隔轮转取样，每位学习者看 3 条别类条目
    const crossItems = items
      .filter(item => item.subcategory !== persona.prefer)
      .filter((_, index) => index % personas.length === 0)
      .slice(0, 3)

    // 时间游标：从 13 天前附近起步，每条事件向前推进若干小时，天然落在近两周内
    let daysAgo = DEMO_WINDOW_DAYS - 1 - rand()
    const nextTime = () => {
      daysAgo = Math.max(0, daysAgo - (0.15 + rand() * 0.35))
      return new Date(now - daysAgo * dayMs)
    }

    // 浏览条目：偏好条目每人 4~6 次（画像主特征），跨类条目各 1 次
    const viewCounts = preferredItems.map(() => 4 + Math.floor(rand() * 3))
    for (const [index, item] of preferredItems.entries()) {
      for (let v = 0; v < viewCounts[index]!; v++) {
        events.push({ userId: persona.userId, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: item.id, createdAt: nextTime() })
      }
    }
    for (const item of crossItems) {
      events.push({ userId: persona.userId, type: 'VIEW_ITEM', targetType: 'CRAFT_ITEM', targetId: item.id, createdAt: nextTime() })
    }

    // 课程学习：完整学完偏好子类别的课程；再试学相邻子类别的课程（约一半步骤），
    // 相邻按去重后的子类别序列轮转（同子类别的两位学习者互为同好，不能互为跨类对象）
    const preferredCourse = courses.find(course => course.craftItem.subcategory === persona.prefer)
    if (!preferredCourse || preferredCourse.steps.length === 0) {
      throw new Error(`[demo-seed] 子类别无已发布课程，无法合成学习进度：${persona.prefer}`)
    }
    const subcategories = [...new Set(courses.map(course => course.craftItem.subcategory))]
    const nextSubcategory = subcategories[(subcategories.indexOf(persona.prefer) + 1) % subcategories.length]!
    const crossCourse = courses.find(course => course.craftItem.subcategory === nextSubcategory)

    const studyCourse = (course: { id: string, steps: Array<{ id: string }> }, stepLimit: number) => {
      events.push({ userId: persona.userId, type: 'START_COURSE', targetType: 'COURSE', targetId: course.id, createdAt: nextTime() })
      for (const step of course.steps.slice(0, stepLimit)) {
        const completedAt = nextTime()
        events.push({ userId: persona.userId, type: 'COMPLETE_STEP', targetType: 'COURSE', targetId: course.id, createdAt: completedAt })
        learningRecords.push({ userId: persona.userId, stepId: step.id, completedAt })
      }
    }
    studyCourse(preferredCourse, preferredCourse.steps.length)
    if (crossCourse && crossCourse.steps.length > 0) {
      studyCourse(crossCourse, Math.max(1, Math.ceil(crossCourse.steps.length / 2)))
    }
  })

  // 发帖/评论事件：复用现有演示帖子与评论（作者即演示学习者），时间取内容本身的发生时间
  for (const post of posts) {
    events.push({ userId: post.authorId, type: 'CREATE_POST', targetType: 'POST', targetId: post.id, createdAt: post.createdAt })
    for (const comment of post.comments) {
      events.push({ userId: comment.authorId, type: 'CREATE_COMMENT', targetType: 'COMMENT', targetId: comment.id, createdAt: comment.createdAt })
    }
  }

  // ---- 后造：整批写入 ----
  for (let i = 0; i < events.length; i += 100) {
    await prisma.behaviorEvent.createMany({ data: events.slice(i, i + 100) })
  }
  for (let i = 0; i < learningRecords.length; i += 100) {
    await prisma.learningRecord.createMany({ data: learningRecords.slice(i, i + 100) })
  }
  return { eventCount: events.length, recordCount: learningRecords.length }
}

/** 落库结果自检：画像与推荐任一为空即判失败（退出码非 0，部署脚本可感知） */
async function verifyDemoResult(demoUserIds: number[]): Promise<{ profileCount: number, recommendationCount: number }> {
  const prisma = usePrisma()
  const [profiles, recommendations] = await Promise.all([
    prisma.learnerProfile.findMany({ where: { userId: { in: demoUserIds } }, select: { clusterLabel: true } }),
    prisma.recommendation.findMany({ where: { userId: { in: demoUserIds } }, select: { id: true } }),
  ])
  if (profiles.length < demoUserIds.length || profiles.some(p => !p.clusterLabel)) {
    throw new Error(`[demo-seed] 自检失败：演示学习者画像不完整（${profiles.length}/${demoUserIds.length}）`)
  }
  if (recommendations.length === 0) {
    throw new Error('[demo-seed] 自检失败：演示学习者推荐为空')
  }
  return { profileCount: profiles.length, recommendationCount: recommendations.length }
}

async function main() {
  const prisma = usePrisma()
  await runContentSeed()
  await seedExtraLearners()
  const { eventCount, recordCount } = await synthesizeBehavior()

  console.log(`[demo-seed] 行为事件合成完成：${DEMO_PERSONAS.length} 名演示学习者共 ${eventCount} 条事件（近两周，先清后造）、学习记录 ${recordCount} 条`)
  const result = await rebuildProfilesAndRecommendations()
  console.log(`[demo-seed] 画像重建完成：学习者 ${result.learnerCount} 名、画像 ${result.profileCount} 份（k=${result.chosenK}）、推荐 ${result.recommendationCount} 条`
    + (result.skippedClustering ? '（学习者过少，已跳过聚类走全站热门兜底）' : ''))

  const demoUserIds = await prisma.user.findMany({
    where: { username: { in: DEMO_PERSONAS.map(p => p.username) } },
    select: { id: true },
  }).then(rows => rows.map(row => row.id))
  const { profileCount, recommendationCount } = await verifyDemoResult(demoUserIds)

  const labels = await prisma.learnerProfile.findMany({
    where: { userId: { in: demoUserIds } },
    select: { clusterLabel: true },
    orderBy: { clusterLabel: 'asc' },
  })
  console.log(`[demo-seed] 自检通过：演示学习者画像 ${profileCount} 份、推荐 ${recommendationCount} 条，画像标签：${[...new Set(labels.map(l => l.clusterLabel))].join('、')}`)
  console.log('[demo-seed] 完成：演示账号与凭据见 README「演示账号」')
}

main()
  .catch((err) => {
    console.error('[demo-seed] 失败：', err)
    process.exitCode = 1
  })
  .finally(() => usePrisma().$disconnect())
