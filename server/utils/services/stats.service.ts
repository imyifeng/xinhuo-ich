import { usePrisma } from '../prisma'

export interface PlatformStats {
  /** 技艺条目总数 */
  craftItemCount: number
  /** 子类别数（去重） */
  categoryCount: number
}

/** 平台统计：首页占位数据，证明 接入 → 业务 → 数据 三层贯通 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const db = usePrisma()
  const [craftItemCount, categories] = await Promise.all([
    db.craftItem.count(),
    db.craftItem.findMany({
      select: { category: true },
      distinct: ['category'],
    }),
  ])
  return { craftItemCount, categoryCount: categories.length }
}
