<script setup lang="ts">
interface CraftListItem {
  id: string
  name: string
  subcategory: string
  region: string
  batch: string
  images: Array<{ url: string, credit: string }>
  tags: string[]
}

interface CraftItemListResponse {
  items: CraftListItem[]
  total: number
  page: number
  pageSize: number
  subcategories: string[]
}

const PAGE_SIZE = 12

const route = useRoute()
const router = useRouter()

// 筛选与页码都落在 URL 上，可分享、可回退
const activeSubcategory = computed(() => typeof route.query.subcategory === 'string' ? route.query.subcategory : '')
const currentPage = computed(() => {
  const parsed = Number.parseInt(String(route.query.page ?? '1'), 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
})

const { data, status } = await useFetch<CraftItemListResponse>('/api/craft-items', {
  query: {
    subcategory: activeSubcategory,
    page: currentPage,
    pageSize: PAGE_SIZE,
  },
  watch: [activeSubcategory, currentPage],
})

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)))

/** 页码列表：最多展示 7 个，当前页居中 */
const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const start = Math.max(1, Math.min(current - 3, total - 6))
  return Array.from({ length: Math.min(7, total) }, (_, i) => start + i)
})

function selectSubcategory(subcategory: string) {
  router.push({ query: { ...route.query, subcategory: subcategory || undefined, page: undefined } })
}

function goPage(page: number) {
  router.push({ query: { ...route.query, page: page > 1 ? page : undefined } })
}

useHead({ title: '技艺条目 · 薪火', htmlAttrs: { lang: 'zh-CN' } })
</script>

<template>
  <div>
    <!-- 页头：衬线标题 + 收录说明 -->
    <header class="border-b border-stone-200 bg-gradient-to-b from-orange-50/70 to-stone-50">
      <div class="mx-auto max-w-5xl px-6 py-12">
        <p class="text-xs font-medium uppercase tracking-[0.25em] text-orange-600">Collection</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-wide">技艺条目</h1>
        <p class="mt-3 text-sm leading-relaxed text-stone-500">
          传统技艺类国家级非遗代表性项目，共收录 <span class="font-semibold text-stone-700">{{ data?.total ?? 0 }}</span> 条，按子类别筛选浏览。
        </p>
      </div>
    </header>

    <div class="mx-auto max-w-5xl px-6 py-10">
      <!-- 子类别筛选 -->
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full border px-4 py-1.5 text-sm transition"
          :class="activeSubcategory === ''
            ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
            : 'border-stone-300 bg-white text-stone-600 hover:border-orange-400 hover:text-orange-600'"
          @click="selectSubcategory('')"
        >
          全部
        </button>
        <button
          v-for="sc in data?.subcategories ?? []"
          :key="sc"
          type="button"
          class="rounded-full border px-4 py-1.5 text-sm transition"
          :class="activeSubcategory === sc
            ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
            : 'border-stone-300 bg-white text-stone-600 hover:border-orange-400 hover:text-orange-600'"
          @click="selectSubcategory(sc)"
        >
          {{ sc }}
        </button>
      </div>

      <!-- 条目卡片 -->
      <div v-if="status === 'pending'" class="mt-8 py-20 text-center text-sm text-stone-400">
        加载中……
      </div>
      <div v-else-if="data?.items.length" class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <CraftItemCard v-for="item in data.items" :key="item.id" :item="item" />
      </div>
      <p v-else class="mt-8 rounded-xl border border-dashed border-stone-300 p-16 text-center text-sm text-stone-400">
        没有找到符合条件的技艺条目。
      </p>

      <!-- 分页 -->
      <nav v-if="(data?.total ?? 0) > PAGE_SIZE" class="mt-12 flex items-center justify-center gap-1.5" aria-label="分页">
        <button
          type="button"
          class="rounded-full border border-stone-300 px-4 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-orange-400 hover:text-orange-600"
          :disabled="currentPage <= 1"
          @click="goPage(currentPage - 1)"
        >
          上一页
        </button>
        <button
          v-for="p in pageNumbers"
          :key="p"
          type="button"
          class="min-w-9 rounded-full border px-3 py-1.5 text-sm transition"
          :class="p === currentPage
            ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
            : 'border-stone-300 bg-white text-stone-600 hover:border-orange-400 hover:text-orange-600'"
          @click="goPage(p)"
        >
          {{ p }}
        </button>
        <button
          type="button"
          class="rounded-full border border-stone-300 px-4 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-orange-400 hover:text-orange-600"
          :disabled="currentPage >= totalPages"
          @click="goPage(currentPage + 1)"
        >
          下一页
        </button>
      </nav>
    </div>
  </div>
</template>
