import { createAdminCraftItem } from '../../../utils/services/admin-craft-item.service'

/** 创建技艺条目（管理端，工单 #5）：含标签关联与图集数组，默认发布状态可显式置为草稿 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const created = await createAdminCraftItem(await readBody(event))
  setResponseStatus(event, 201)
  return created
})
