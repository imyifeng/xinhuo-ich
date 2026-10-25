/** 登出：销毁 Redis 会话并清除 Cookie（幂等，未登录同样返回 200） */
export default defineEventHandler(async (event) => {
  await destroySession(event)
  return { ok: true }
})
