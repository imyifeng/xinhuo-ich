import { deleteAdminTag } from '../../../utils/services/admin-tag.service'

/** 删除标签（管理端，工单 #5）：与条目的关联由外键级联解除 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  await deleteAdminTag(getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
