import { updateAdminTag } from '../../../utils/services/admin-tag.service'

/** 重命名标签（管理端，工单 #5） */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return updateAdminTag(getRouterParam(event, 'id') ?? '', await readBody(event))
})
