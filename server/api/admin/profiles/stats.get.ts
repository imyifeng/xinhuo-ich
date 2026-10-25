import { requireAdmin } from '../../../utils/admin'
import { getAdminPlatformStats } from '../../../utils/services/admin-stats.service'

/** 平台统计（管理端"画像统计"页，用户故事 26）：用户数（按角色分）+ 学习行为量（按五类事件计数）
 *  + 既有画像簇分布与特征均值表，合并输出同屏展示（报告素材） */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getAdminPlatformStats()
})
