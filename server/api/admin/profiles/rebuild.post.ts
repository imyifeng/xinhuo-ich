import { requireAdmin } from '../../../utils/admin'
import { rebuildProfilesAndRecommendations } from '../../../utils/services/recommendation.service'

/** 手动触发画像与推荐重建（管理端，规格用户故事 25）：与每日 cron 共用同一管道入口 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return rebuildProfilesAndRecommendations()
})
