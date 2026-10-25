import { AuthError, registerUser } from '../../utils/services/auth.service'

/** 注册：用户名 3~30 字符唯一 + 密码 ≥8 位；成功返回 201 与公开用户信息 */
export default defineEventHandler(async (event) => {
  try {
    const user = await registerUser(await readBody(event))
    setResponseStatus(event, 201)
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
