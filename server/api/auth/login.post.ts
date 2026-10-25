import { AuthError, authenticateUser } from '../../utils/services/auth.service'

/** 登录：argon2 校验密码后签发会话（session.ts 共享契约：httpOnly Cookie + Redis） */
export default defineEventHandler(async (event) => {
  try {
    const user = await authenticateUser(await readBody(event))
    await createSession(event, { userId: user.id, role: user.role })
    return user
  }
  catch (error) {
    if (error instanceof AuthError) {
      setResponseStatus(event, error.status)
      return { error: error.message }
    }
    throw error
  }
})
