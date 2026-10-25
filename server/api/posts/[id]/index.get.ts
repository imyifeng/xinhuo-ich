import { getPostDetail } from '../../../utils/services/post.service'

/** 帖子详情（公开，工单 #7）：不存在或已下架一律 404 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const detail = await getPostDetail(id)
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: '帖子不存在或已下架' })
  }
  return detail
})
