import { createPost } from '../../utils/services/post.service'
import { getUserById } from '../../utils/services/auth.service'
import { AuthError } from '../../utils/services/auth.service'
import { getSessionUser } from '../../utils/session'

/** 发帖（工单 #7 / 用户故事 8）：仅登录用户（学习者/传承人/管理员均可），成功返回 201；
 *  写入 CREATE_POST 事件；业务校验错误（400）由 AuthError 映射。 */
export default defineEventHandler(async (event) => {
  const session = await getSessionUser(event)
  const user = session ? await getUserById(session.userId) : null
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: '请先登录后再发帖' })
  }

  try {
    const created = await createPost(user.id, await readBody(event))
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
