<script setup lang="ts">
/**
 * 区块标题（工单 #10 视觉打磨）：首页与条目详情页共用的统一标题层级——
 * 小号英文导语（字距拉开作装饰）+ 中文衬线主标题，右侧留操作位（查看全部等）。
 */
defineProps<{
  title: string
  /** 英文小导语（纯装饰，可省略） */
  eyebrow?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p v-if="eyebrow" class="text-xs font-medium uppercase tracking-[0.25em] text-orange-600">
        {{ eyebrow }}
      </p>
      <h2 class="mt-1 font-display text-2xl font-bold tracking-wide text-stone-900">
        {{ title }}
      </h2>
    </div>
    <slot name="action" />
  </div>
</template>
