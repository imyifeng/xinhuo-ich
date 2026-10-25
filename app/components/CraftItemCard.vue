<script setup lang="ts">
// 技艺条目卡片：首页精选区与列表页共用
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
    class="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
  >
    <div class="aspect-[4/3] overflow-hidden bg-stone-100">
      <img
        v-if="cover"
        :src="cover"
        :alt="item.name"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        loading="lazy"
      >
      <div v-else class="flex h-full items-center justify-center text-4xl text-stone-300">薪</div>
    </div>
    <div class="flex flex-1 flex-col gap-2 p-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold group-hover:text-orange-700">{{ item.name }}</h3>
        <span class="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">{{ item.subcategory }}</span>
      </div>
      <p class="text-xs text-stone-500">{{ item.region }} · {{ item.batch }}</p>
      <p v-if="item.tags.length" class="mt-auto pt-1 text-xs text-stone-400">
        {{ item.tags.slice(0, 3).join(' / ') }}
      </p>
    </div>
  </NuxtLink>
</template>
