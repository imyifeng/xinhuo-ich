<script setup lang="ts">
// 技艺条目卡片：首页精选区与列表页共用（工单 #10 视觉打磨：
// 封面统一 4:3、子类别徽章叠图、文字区三级层级——名称/地域批次/标签）
interface CraftListItemView {
  id: string
  name: string
  subcategory: string
  region: string
  batch: string
  images: Array<{ url: string, credit: string }>
  tags: string[]
}

const props = defineProps<{ item: CraftListItemView }>()

const cover = computed(() => props.item.images[0]?.url ?? null)
</script>

<template>
  <NuxtLink
    :to="`/craft-items/${item.id}`"
    :prefetch="false"
    class="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100/60"
  >
    <div class="relative aspect-[4/3] overflow-hidden bg-stone-100">
      <img
        v-if="cover"
        :src="cover"
        :alt="item.name"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        loading="lazy"
      >
      <div v-else class="flex h-full items-center justify-center bg-gradient-to-br from-orange-50 to-stone-100 font-display text-5xl text-stone-300">
        薪
      </div>
      <!-- 子类别徽章叠图：压深色渐变保证可读 -->
      <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-900/50 to-transparent px-4 pb-2.5 pt-8 text-right">
        <span class="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-stone-700 backdrop-blur">
          {{ item.subcategory }}
        </span>
      </span>
    </div>
    <div class="flex flex-1 flex-col p-5">
      <h3 class="font-display text-lg font-bold tracking-wide group-hover:text-orange-700">{{ item.name }}</h3>
      <p class="mt-1.5 text-xs text-stone-500">{{ item.region }} · {{ item.batch }}</p>
      <p v-if="item.tags.length" class="mt-auto pt-3 text-xs text-stone-400">
        {{ item.tags.slice(0, 3).join(' · ') }}
      </p>
    </div>
  </NuxtLink>
</template>
