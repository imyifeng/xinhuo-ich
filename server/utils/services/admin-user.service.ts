import { toPublicUser } from './auth.service'
import type { PublicUser } from './auth.service'
import { usePrisma } from '../prisma'

/**
 * 账号管理业务层（工单 #5）：账号列表 + 角色标记。
 * 角色语义见 GLOSSARY：学习者（LEARNER）/ 传承人（INHERITOR）/ 管理员（ADMIN），
 * 传承人由管理员线下核实后标记，无线上自助认证。
 */

/** 账号列表（管理端）：返回全部账号的公开字段（passwordHash 永不出库） */
export async function listAdminUsers(): Promise<{ items: PublicUser[], total: number }> {
  const rows = await usePrisma().user.findMany({ orderBy: [{ id: 'asc' }] })
  return { items: rows.map(toPublicUser), total: rows.length }
}
