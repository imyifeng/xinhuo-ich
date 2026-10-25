import { createComment } from '../../../../utils/services/post.service'
import { getUserById } from '../../../../utils/services/auth.service'
import { AuthError } from '../../../../utils/services/auth.service'
import { getSessionUser } from '../../../../utils/session'

/** 评论帖子（工单 #7 / 用户故事 9）：仅登录用户，帖子须存在且可见（否则 404）；
 *  写入 CREATE_COMMENT 事件；业务校验错误（400/404）由 AuthError 映射。 */
export default defineEventHandler(async (event) => {
  const session = await getSessionUser(event)
  const user = session ? await getUserById(session.userId) : null
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: '请先登录后再评论' })
  }

  const postId = getRouterParam(event, 'id') ?? ''
  try {
    const created = await createComment(postId, user.id, await readBody(event))
    setResponseStatus(event, 201)
    return created
  }
  catch (error) {
    if (error instanceof AuthError) {
      setResponseStatus(event, error.status)
      return { error: error.message }
    }
    throw error
  }
})
