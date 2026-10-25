import { createPost } from '../../utils/services/post.service'

/** 发帖（工单 #7 / 用户故事 8）：仅登录用户（学习者/传承人/管理员均可），成功返回 201；
 *  写入 CREATE_POST 事件；业务校验错误（400）由 defineGuardedHandler 统一映射。 */
export default defineGuardedHandler(async (event) => {
  const user = await requireSessionUser(event)
  const created = await createPost(user.id, await readBody(event))
  setResponseStatus(event, 201)
  return created
})
