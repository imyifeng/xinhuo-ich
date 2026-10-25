import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../server/generated/prisma/client'
import './load-env'

// 种子数据：仅用于 T1 首页计数演示的最小数据集（均为国家级名录真实条目）。
// 完整名录种子（20~30 项，含批次/编号）由后续工单补全。

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const craftItems = [
  { name: '景德镇手工制瓷技艺', category: '陶瓷', region: '江西省' },
  { name: '宜兴紫砂陶制作技艺', category: '陶瓷', region: '江苏省' },
  { name: '龙泉青瓷烧制技艺', category: '陶瓷', region: '浙江省' },
  { name: '南京云锦织造技艺', category: '织绣', region: '江苏省' },
  { name: '成都漆艺', category: '漆器', region: '四川省' },
  { name: '宣纸制作技艺', category: '造纸印刷', region: '安徽省' },
]

async function main() {
  const result = await prisma.craftItem.createMany({
    data: craftItems,
    skipDuplicates: true,
  })
  const total = await prisma.craftItem.count()
  console.log(`[seed] 新增技艺条目 ${result.count} 条，当前共 ${total} 条`)
}

main()
  .catch((err) => {
    console.error('[seed] 失败：', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
