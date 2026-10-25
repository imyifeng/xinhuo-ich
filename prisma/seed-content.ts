import { hash } from '@node-rs/argon2'
import { usePrisma } from '../server/utils/prisma'
import { SEED_CRAFT_ITEMS } from './seed-data'
import { SEED_COURSES } from './seed-courses'

/**
 * 内容种子（技艺条目 / 标签 / 传承人 / 课程 / 演示账号 / 交流区帖子）。
 * 自 seed.ts 抽出为可复用模块（工单 #10）：db:seed 与 demo:seed 共用同一条内容基线，
 * demo:seed 在此之上叠加合成行为事件与画像重建。
 *
 * 幂等约定（可重复执行）：
 * - 技艺条目按 name upsert；标签按 name upsert；传承人按（条目, 姓名）upsert；
 * - 课程按（标题, 作者）upsert，已存在时重建步骤；
 * - 演示账号按 username upsert（存在则不动）；帖子按标题判重，仅在缺失时创建（含评论）。
 */

/** 演示学习者账号（工单 #7）：交流区演示帖子/评论的作者。仅用于开发/演示。 */
export const SEED_LEARNERS = [
  { username: 'taotao', displayName: '陶陶学瓷', password: 'taotao123456' },
  { username: 'shanshan', displayName: '山山织语', password: 'shanshan123456' },
  { username: 'muzi', displayName: '木子观纸', password: 'muzi123456' },
] as const

interface SeedComment {
  author: (typeof SEED_LEARNERS)[number]['username']
  content: string
}

interface SeedPost {
  author: (typeof SEED_LEARNERS)[number]['username']
  title: string
  content: string
  comments: SeedComment[]
}

/** 演示帖子：围绕制瓷/织绣/造纸的学习心得与提问（工单 #7） */
const SEED_POSTS: SeedPost[] = [
  {
    author: 'taotao',
    title: '第一次拉坯成功的心得：手要稳，心要慢',
    content: '跟着平台课程练了三周，今天终于拉出一个像样的碗底。最大的体会是两手一定要有支撑点，肘部架在腿上，泥团居中后再慢慢开孔。失败十几次都是因为急着提筒，泥料水分一失就歪。分享给同样在入门的朋友：别急，先把揉泥练扎实。',
    comments: [
      { author: 'shanshan', content: '恭喜！“先揉泥后拉坯”确实是过来人的共识，织绣里理线也是一个道理。' },
      { author: 'muzi', content: '请问用的哪种泥料？我想找个接近宣纸抄纸手感的练习材料。' },
    ],
  },
  {
    author: 'taotao',
    title: '请教：釉面开片是烧制问题还是配方问题？',
    content: '自己配的石灰釉烧出来全是细密开片，本来想要温润的影青效果。升温曲线是按课程里说的 1280 度还原烧，怀疑是釉浆过筛不够细，或者是冷却太快。有经验的伙伴能指点一下排查顺序吗？',
    comments: [
      { author: 'muzi', content: '先查釉浆细度吧，我们造纸筛浆也是同理，颗粒粗了表面就毛糙。' },
      { author: 'shanshan', content: '帮顶，等一个配方大佬。' },
    ],
  },
  {
    author: 'shanshan',
    title: '苏绣入门一个月：劈丝比想象中难',
    content: '按教程把一根花线劈到十六分之一，手抖得根本挂不住针。后来发现诀窍是指甲要留一点点、指尖保持干燥，劈之前先用掐的手感找到纤维走向。现在能绣出第一片花瓣了，虽然歪歪扭扭，晒图留念（等拍好再传）。',
    comments: [
      { author: 'taotao', content: '“指尖保持干燥”这个细节太真实了，拉坯正好相反，手要湿。' },
      { author: 'muzi', content: '期待晒图！' },
    ],
  },
  {
    author: 'shanshan',
    title: '织机经线张力不均，求排查思路',
    content: '老式木织机，织到中段总是右边松左边紧，布面起皱。检查了综片和卷轴都没发现明显问题。是不是经轴上的经线绕的时候松紧就不一致了？重新整经工作量大，想先听听大家的排查经验。',
    comments: [
      { author: 'muzi', content: '我们抄纸的帘子也讲究受力均匀，猜测是整经时张力没有逐根校准，可以试着在边纲处加个小的配重过渡。' },
    ],
  },
  {
    author: 'muzi',
    title: '抄纸第一周小结：纸浆浓度是灵魂',
    content: '跟着课程试了楮皮浆，第一帘抄出来厚得像毛毯，第二帘又薄得透光。师傅说得对：抄纸的手感全在“晃帘”两下，浓度固定之后剩下的就是练习。记录一下配比：楮皮浆对水大约 1:20，日温 24 度时的状态最顺手。',
    comments: [
      { author: 'taotao', content: '“晃帘两下”和拉坯的“三提两转”一样，都是口传心授的手感，课程能把它写清楚太不容易了。' },
      { author: 'shanshan', content: '记下了，周末去工坊试试。' },
    ],
  },
  {
    author: 'muzi',
    title: '提问：宣纸传统的日晒雨淋漂白，现在还可行吗？',
    content: '课程里提到传统漂白是把纸浆摊在山坡上日晒雨淋数月，天然又温和。但我在城里实践条件有限，想请教：有没有小规模的替代方案，既接近传统效果，又不至于用强氧化剂伤纤维？',
    comments: [
      { author: 'taotao', content: '不懂造纸，但“阳台山坡”听起来可行，帮蹲一个答案。' },
    ],
  },
  {
    author: 'taotao',
    title: '参观湖田窑遗址随想：薪火真的相传',
    content: '周末去了湖田窑遗址，站在宋代龙窑的窑床前，突然理解了课程里说的“一窑火要守一整夜”。千年前的匣钵还垒在原地，而我们今天在平台上跟着视频学同样的工序，这大概就是这个平台名字的含义吧。',
    comments: [
      { author: 'shanshan', content: '有画面感了，下个月计划去镇上看一次开窑。' },
      { author: 'muzi', content: '“薪火相传”四个字在这里具象化了。' },
    ],
  },
]

async function seedCraftItems() {
  const prisma = usePrisma()
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
  await usePrisma().user.upsert({
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
  return usePrisma().user.upsert({
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
  const prisma = usePrisma()
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

/** 交流区演示数据（工单 #7）：学习者幂等 upsert；帖子按标题判重，仅在缺失时创建（含评论）。 */
async function seedCommunity() {
  const prisma = usePrisma()
  const userIds = new Map<string, number>()
  for (const learner of SEED_LEARNERS) {
    const user = await prisma.user.upsert({
      where: { username: learner.username },
      create: {
        username: learner.username,
        displayName: learner.displayName,
        passwordHash: await hash(learner.password),
        role: 'LEARNER',
      },
      update: {},
    })
    userIds.set(learner.username, user.id)
  }

  let createdPosts = 0
  for (const post of SEED_POSTS) {
    const existing = await prisma.post.findFirst({ where: { title: post.title }, select: { id: true } })
    if (existing) continue
    const created = await prisma.post.create({
      data: {
        authorId: userIds.get(post.author)!,
        title: post.title,
        content: post.content,
      },
    })
    for (const comment of post.comments) {
      await prisma.comment.create({
        data: {
          postId: created.id,
          authorId: userIds.get(comment.author)!,
          content: comment.content,
        },
      })
    }
    createdPosts++
  }
  return createdPosts
}

/** 执行完整内容种子（db:seed 与 demo:seed 共用的内容基线） */
export async function runContentSeed(): Promise<{ createdPosts: number }> {
  await seedCraftItems()
  const inheritor = await seedInheritorUser()
  await seedCourses(inheritor.id)
  await seedAdminUser()
  const createdPosts = await seedCommunity()
  return { createdPosts }
}
