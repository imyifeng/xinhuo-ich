import { getPlatformStats } from '../utils/services/stats.service'

/** 平台统计（首页展示用） */
export default defineEventHandler(() => getPlatformStats())
