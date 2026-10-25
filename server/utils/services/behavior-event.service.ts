import type { BehaviorEventType } from '../../generated/prisma/client'
import { usePrisma } from '../prisma'

export interface BehaviorEventInput {
  userId: number
  type: BehaviorEventType
  /** 多态目标类型（如 CRAFT_ITEM） */
  targetType: string
  targetId: string
}

/** 记录学习行为事件（仅登录用户调用方保证）：画像的原始数据，写入失败不阻断主流程 */
export async function recordBehaviorEvent(input: BehaviorEventInput): Promise<void> {
  const db = usePrisma()
  await db.behaviorEvent.create({
    data: {
      userId: input.userId,
      type: input.type,
      targetType: input.targetType,
      targetId: input.targetId,
    },
  })
}
