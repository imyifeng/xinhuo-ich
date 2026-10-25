import { getUserById } from '../../utils/services/auth.service'
import type { SessionPayload } from '../../utils/session'

/** 当前登录用户信息：读取会话（session.ts 共享契约），未登录或用户已不存在返回 401 */
export default defineEventHandler(async (event) => {
  const session: SessionPayload | null = await getSessionUser(event)
  if (!session) {
    setResponseStatus(event, 401)
    return { error: '未登录' }
  }
  const user = await getUserById(session.userId)
  if (!user) {
    setResponseStatus(event, 401)
    return { error: '未登录' }
  }
  return user
})
