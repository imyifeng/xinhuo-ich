import { requireAdmin } from '../../../utils/admin'
import { getProfileStats } from '../../../utils/services/recommendation.service'

/** 画像统计（管理端"画像统计"页）：各簇人数分布 + 特征均值表（报告 5.1 素材） */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getProfileStats()
})
