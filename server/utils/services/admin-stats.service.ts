import type { BehaviorEventType, Role } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'
import { getProfileStats, type ProfileStats } from './recommendation.service'

/**
 * 管理端平台统计业务层（工单 #5 / 用户故事 26）：
 * 在既有画像簇分布（recommendation.service 的 getProfileStats）之外，
 * 合并输出用户总数（按角色分）与学习行为总量（behavior_event 按五类事件计数），
 * 供 /admin/profiles 页面与簇分布同屏展示、写进实践报告。
 */

export interface AdminPlatformStats extends ProfileStats {
  /** 用户总数，按角色分（GLOSSARY：学习者 LEARNER / 传承人 INHERITOR / 管理员 ADMIN） */
  users: { total: number, byRole: Record<Role, number> }
  /** 学习行为总量：五类事件（用户故事 27）各类型计数 */
  behavior: { total: number, byType: Record<BehaviorEventType, number> }
}

/** 平台统计：用户数、行为量与画像簇分布一次返回（管理员，角色守卫在接入层） */
export async function getAdminPlatformStats(): Promise<AdminPlatformStats> {
  const db = usePrisma()
  const [profileStats, roleGroups, typeGroups] = await Promise.all([
    getProfileStats(),
    db.user.groupBy({ by: ['role'], _count: { _all: true } }),
    db.behaviorEvent.groupBy({ by: ['type'], _count: { _all: true } }),
  ])

  const byRole: Record<Role, number> = { LEARNER: 0, INHERITOR: 0, ADMIN: 0 }
  for (const group of roleGroups) {
    byRole[group.role] = group._count._all
  }
  const byType: Record<BehaviorEventType, number> = {
    VIEW_ITEM: 0,
    START_COURSE: 0,
    COMPLETE_STEP: 0,
    CREATE_POST: 0,
    CREATE_COMMENT: 0,
  }
  for (const group of typeGroups) {
    byType[group.type] = group._count._all
  }

  return {
    ...profileStats,
    users: { total: Object.values(byRole).reduce((sum, count) => sum + count, 0), byRole },
    behavior: { total: Object.values(byType).reduce((sum, count) => sum + count, 0), byType },
  }
}
