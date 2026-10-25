import { createAdminInheritor } from '../../../utils/services/admin-inheritor.service'

/** 创建传承人（管理端，工单 #5）：挂到技艺条目下 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const created = await createAdminInheritor(await readBody(event))
  setResponseStatus(event, 201)
  return created
})
