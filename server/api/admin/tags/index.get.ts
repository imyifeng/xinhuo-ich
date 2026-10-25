import { listAdminTags } from '../../../utils/services/admin-tag.service'

/** 标签列表（管理端，工单 #5）：附带关联条目数，支持名称搜索 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  return listAdminTags({ q: typeof query.q === 'string' ? query.q : undefined })
})
