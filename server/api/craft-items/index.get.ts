import { listCraftItems } from '../../utils/services/craft-item.service'

/** 技艺条目列表（仅已发布）：?subcategory=&page=&pageSize= */
export default defineEventHandler((event) => {
  const query = getQuery(event)
  return listCraftItems({
    subcategory: typeof query.subcategory === 'string' ? query.subcategory : undefined,
    page: typeof query.page === 'string' || typeof query.page === 'number' ? Number(query.page) : undefined,
    pageSize: typeof query.pageSize === 'string' || typeof query.pageSize === 'number' ? Number(query.pageSize) : undefined,
  })
})
