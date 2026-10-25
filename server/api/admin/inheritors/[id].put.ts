import { updateAdminInheritor } from '../../../utils/services/admin-inheritor.service'

/** 更新传承人（管理端，工单 #5）：字段整体替换，可改挂条目 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return updateAdminInheritor(getRouterParam(event, 'id') ?? '', await readBody(event))
})
