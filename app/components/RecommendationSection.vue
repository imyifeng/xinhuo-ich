<script setup lang="ts">
/**
 * "为你推荐"区（工单 #8）：首页与技艺条目详情页共用。
 * feed 由父页面从 /api/recommendations 取得——登录学习者得到画像驱动的个性化结果，
 * 游客（401）与未登录场景父页面传 null，整个区块不渲染。
 * 每张卡片带汉字推荐理由（"同好都在学"/"全站热门"等），让推荐来源可解释（规格用户故事 13/14）。
 */
interface FeedEntry {
  type: 'CRAFT_ITEM' | 'COURSE'
  craftItemId: string | null
  courseId: string | null
  title: string
  subtitle: string
  image: { url: string, credit: string } | null
  reason: string
}

interface RecommendationFeed {
  clusterLabel: string | null
  entries: FeedEntry[]
}

const props = defineProps<{ feed: RecommendationFeed | null }>()

const linkOf = (entry: FeedEntry) =>
  entry.type === 'COURSE' ? `/courses/${entry.courseId}` : `/craft-items/${entry.craftItemId}`
</script>

<template>
  <section v-if="feed && feed.entries.length">
    <div class="flex flex-wrap items-baseline gap-2">
      <h2 class="text-lg font-semibold">为你推荐</h2>
      <span
        v-if="feed.clusterLabel"
        class="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-700"
      >
        你的画像：{{ feed.clusterLabel }}
      </span>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="entry in feed.entries"
        :key="entry.courseId ?? entry.craftItemId"
        :to="linkOf(entry)"
        :prefetch="false"
        class="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
      >
        <div class="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2">
          <span class="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
            {{ entry.type === 'COURSE' ? '课程' : '技艺条目' }}
          </span>
          <span class="text-xs text-orange-600">{{ entry.reason }}</span>
        </div>
        <div v-if="entry.image" class="aspect-[16/9] overflow-hidden bg-stone-100">
          <img
            :src="entry.image.url"
            :alt="entry.title"
            class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          >
        </div>
        <div v-else class="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-orange-50 to-stone-50 text-3xl text-stone-300">
          习
        </div>
        <div class="flex flex-1 flex-col gap-1 p-4">
          <h3 class="font-semibold group-hover:text-orange-700">{{ entry.title }}</h3>
          <p class="text-xs text-stone-500">{{ entry.subtitle }}</p>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
