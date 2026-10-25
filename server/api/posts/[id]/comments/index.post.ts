import { createComment } from '../../../../utils/services/post.service'

/** 评论帖子（工单 #7 / 用户故事 9）：仅登录用户，帖子须存在且可见（否则 404）；
 *  写入 CREATE_COMMENT 事件；业务校验错误（400/404）由 defineGuardedHandler 统一映射。 */
export default defineGuardedHandler(async (event) => {
  const user = await requireSessionUser(event)
  const postId = getRouterParam(event, 'id') ?? ''
  const created = await createComment(postId, user.id, await readBody(event))
  setResponseStatus(event, 201)
  return created
})
