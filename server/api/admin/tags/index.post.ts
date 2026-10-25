import { createAdminTag } from '../../../utils/services/admin-tag.service'

/** 创建标签（管理端，工单 #5） */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const created = await createAdminTag(await readBody(event))
  setResponseStatus(event, 201)
  return created
})
