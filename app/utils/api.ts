/** 从 ofetch 错误对象中取出后端 error 文案（后端错误响应统一为 { error: string }）；无则给通用提示 */
export function apiErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'data' in err) {
    const data = (err as { data?: { error?: unknown } }).data
    if (typeof data?.error === 'string' && data.error.length > 0) {
      return data.error
    }
  }
  return '网络异常，请稍后重试'
}
