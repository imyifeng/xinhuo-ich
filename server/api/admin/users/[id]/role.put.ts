import { updateUserRole } from '../../../../utils/services/admin-user.service'

/** 角色标记（管理端，工单 #5 / 用户故事 22）：学习者 ↔ 传承人 ↔ 管理员 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const id = Number.parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (!Number.isFinite(id)) {
    setResponseStatus(event, 404)
    return { error: '账号不存在' }
  }
  return updateUserRole(id, await readBody(event))
})
