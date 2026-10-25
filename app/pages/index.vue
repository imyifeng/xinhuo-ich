<script setup lang="ts">
interface PlatformStats {
  craftItemCount: number
  subcategoryCount: number
}

interface CraftListItem {
  id: string
  name: string
  subcategory: string
  region: string
  batch: string
  images: Array<{ url: string, credit: string }>
  tags: string[]
}

interface RecommendationFeed {
  clusterLabel: string | null
  entries: Array<{
    type: 'CRAFT_ITEM' | 'COURSE'
    craftItemId: string | null
    courseId: string | null
    title: string
    subtitle: string
    image: { url: string, credit: string } | null
    reason: string
  }>
}

// 首页统计：SSR 阶段从 /api/stats 读取数据库计数（接入 → 业务 → 数据 三层贯通的可见证明）
const { data: stats } = await useFetch<PlatformStats>('/api/stats')

// 精选技艺条目：取最近收录的 6 条已发布条目
const { data: featured } = await useFetch<{ items: CraftListItem[] }>('/api/craft-items', {
  query: { pageSize: 6 },
})

// 为你推荐（工单 #8）：登录学习者返回画像驱动的个性化结果，游客 401 → data 为 null → 区块不渲染
const { data: feed } = await useFetch<RecommendationFeed | null>('/api/recommendations', {
  default: () => null,
})

useHead({
  title: '薪火 · 非遗传统技艺数字化展示与学习平台',
  htmlAttrs: { lang: 'zh-CN' },
})
</script>

<template>
  <div>
    <section class="border-b border-stone-200 bg-gradient-to-b from-orange-50 to-stone-50">
      <div class="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 class="text-4xl font-bold tracking-wide sm:text-5xl">薪火相传</h1>
        <p class="mx-auto mt-5 max-w-2xl leading-relaxed text-stone-600">
          非遗传统技艺数字化展示与学习平台——看懂一门技艺，跟着学一遍。
          收录国家级名录中的传统技艺，提供结构化分步课程与学习者交流社区。
        </p>
        <div class="mt-8 flex justify-center gap-4">
          <NuxtLink
            to="/craft-items"
            class="rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-orange-700"
          >
            浏览技艺条目
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-5xl px-6 py-14">
      <h2 class="text-lg font-semibold">平台统计</h2>
      <div class="mt-6 grid grid-cols-2 gap-4 sm:gap-6">
        <div class="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p class="text-4xl font-bold text-orange-600">
            {{ stats?.craftItemCount ?? '—' }}
          </p>
          <p class="mt-2 text-sm text-stone-500">技艺条目</p>
        </div>
        <div class="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p class="text-4xl font-bold text-orange-600">
            {{ stats?.subcategoryCount ?? '—' }}
          </p>
          <p class="mt-2 text-sm text-stone-500">覆盖子类别</p>
        </div>
      </div>
    </section>

    <!-- 为你推荐（工单 #8）：仅登录学习者可见（个性化画像驱动），游客不渲染 -->
    <section v-if="feed" class="mx-auto max-w-5xl px-6 py-14">
      <RecommendationSection :feed="feed" />
    </section>

    <section class="mx-auto max-w-5xl px-6 pb-16">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">精选技艺条目</h2>
        <NuxtLink to="/craft-items" class="text-sm text-orange-600 hover:text-orange-700">
          查看全部 →
        </NuxtLink>
      </div>
      <div v-if="featured?.items.length" class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <CraftItemCard v-for="item in featured.items" :key="item.id" :item="item" />
      </div>
      <p v-else class="mt-6 rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">
        条目收录中，敬请期待。
      </p>
    </section>
  </div>
</template>
