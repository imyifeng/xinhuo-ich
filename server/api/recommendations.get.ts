import { requireSessionUser } from '../utils/learning'
import { getRecommendationFeed } from '../utils/services/recommendation.service'

/** 我的个性化推荐（学习者端，规格用户故事 13/14）：游客 401；
 *  无画像或落库结果为空时服务端实时全站热门兜底 */
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  return getRecommendationFeed(user.id)
})
