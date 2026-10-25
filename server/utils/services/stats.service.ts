import { usePrisma } from '../prisma'

export interface PlatformStats {
  /** 技艺条目总数 */
  craftItemCount: number
  /** 子类别数（去重） */
  subcategoryCount: number
}

/** 平台统计：首页展示用 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const db = usePrisma()
  const [craftItemCount, subcategories] = await Promise.all([
    db.craftItem.count(),
    db.craftItem.findMany({
      select: { subcategory: true },
      distinct: ['subcategory'],
    }),
  ])
  return { craftItemCount, subcategoryCount: subcategories.length }
}
