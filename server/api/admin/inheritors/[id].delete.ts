import { deleteAdminInheritor } from '../../../utils/services/admin-inheritor.service'

/** 删除传承人（管理端，工单 #5） */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  await deleteAdminInheritor(getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
