<script setup lang="ts">
/**
 * 交流区帖子列表（工单 #7 / 用户故事 7~8）：列表公开可看，发帖需登录（未登录引导登录）。
 * 页码落在 URL 上可分享、可回退（与技艺条目列表页一致）。
 */
interface PostListItem {
  id: string
  title: string
  author: { id: number, displayName: string }
  commentCount: number
  createdAt: string
}

interface PostListResponse {
  items: PostListItem[]
  total: number
  page: number
  pageSize: number
}

interface AuthUser {
  id: number
  username: string
  displayName: string
  role: string
}

const PAGE_SIZE = 10

const route = useRoute()
const router = useRouter()

const currentPage = computed(() => {
  const parsed = Number.parseInt(String(route.query.page ?? '1'), 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
})

const { data, status } = await useFetch<PostListResponse>('/api/posts', {
  query: { page: currentPage, pageSize: PAGE_SIZE },
  watch: [currentPage],
})

// 登录态：与 AppHeader 共用 'auth-me' 数据（useFetch 同 key 去重）
const { data: user } = await useFetch<AuthUser | null>('/api/auth/me', {
  key: 'auth-me',
  default: () => null,
})

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)))
const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const start = Math.max(1, Math.min(current - 3, total - 6))
  return Array.from({ length: Math.min(7, total) }, (_, i) => start + i)
})

function goPage(page: number) {
  router.push({ query: { ...route.query, page: page > 1 ? page : undefined } })
}

// ---- 发帖（仅登录用户；未登录引导登录）----
const showComposer = ref(false)
const title = ref('')
const content = ref('')
const submitting = ref(false)
const submitError = ref('')

function onComposeClick() {
  if (!user.value) {
    void navigateTo('/login')
    return
  }
  showComposer.value = !showComposer.value
}

async function onSubmitPost() {
  submitError.value = ''
  submitting.value = true
  try {
    const created = await $fetch<{ id: string }>('/api/posts', {
      method: 'POST',
      body: { title: title.value, content: content.value },
    })
    title.value = ''
    content.value = ''
    showComposer.value = false
    await navigateTo(`/posts/${created.id}`)
  }
  catch (err) {
    submitError.value = apiErrorMessage(err)
  }
  finally {
    submitting.value = false
  }
}

useHead({ title: '交流区 · 薪火', htmlAttrs: { lang: 'zh-CN' } })

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">交流区</h1>
        <p class="mt-2 text-sm text-stone-500">学习心得与提问，共 {{ data?.total ?? 0 }} 条帖子</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
        @click="onComposeClick"
      >
        {{ user ? '发帖' : '登录后发帖' }}
      </button>
    </div>

    <!-- 发帖表单（登录用户可见） -->
    <form
      v-if="showComposer && user"
      class="mt-6 rounded-xl border border-stone-200 bg-white p-5"
      @submit.prevent="onSubmitPost"
    >
      <h2 class="text-sm font-semibold text-stone-700">发布新帖子</h2>
      <input
        v-model="title"
        type="text"
        maxlength="80"
        placeholder="标题（1~80 字）"
        class="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-orange-500"
      >
      <textarea
        v-model="content"
        rows="5"
        maxlength="5000"
        placeholder="分享你的学习心得或提问（1~5000 字）"
        class="mt-3 w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-orange-500"
      />
      <p v-if="submitError" class="mt-2 text-sm text-red-600">{{ submitError }}</p>
      <div class="mt-3 flex items-center gap-3">
        <button
          type="submit"
          :disabled="submitting"
          class="rounded-lg bg-orange-600 px-4 py-1.5 text-sm text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? '发布中…' : '发布' }}
        </button>
        <button
          type="button"
          class="text-sm text-stone-500 transition hover:text-stone-800"
          @click="showComposer = false"
        >
          取消
        </button>
      </div>
    </form>

    <!-- 帖子列表 -->
    <div v-if="status === 'pending'" class="mt-8 py-20 text-center text-sm text-stone-400">
      加载中……
    </div>
    <ul v-else-if="data?.items.length" class="mt-6 space-y-4">
      <li v-for="post in data.items" :key="post.id">
        <NuxtLink
          :to="`/posts/${post.id}`"
          class="block rounded-xl border border-stone-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-sm"
        >
          <h2 class="text-base font-semibold text-stone-900">{{ post.title }}</h2>
          <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
            <span class="text-stone-500">{{ post.author.displayName }}</span>
            <span>{{ formatTime(post.createdAt) }}</span>
            <span>{{ post.commentCount }} 条评论</span>
          </p>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="mt-8 rounded-xl border border-dashed border-stone-300 p-16 text-center text-sm text-stone-400">
      还没有帖子，来发第一条吧。
    </p>

    <!-- 分页 -->
    <nav v-if="(data?.total ?? 0) > PAGE_SIZE" class="mt-10 flex items-center justify-center gap-1.5" aria-label="分页">
      <button
        type="button"
        class="rounded-md border border-stone-300 px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="currentPage <= 1"
        @click="goPage(currentPage - 1)"
      >
        上一页
      </button>
      <button
        v-for="p in pageNumbers"
        :key="p"
        type="button"
        class="min-w-9 rounded-md border px-3 py-1.5 text-sm transition"
        :class="p === currentPage
          ? 'border-orange-600 bg-orange-600 text-white'
          : 'border-stone-300 bg-white text-stone-600 hover:border-orange-400'"
        @click="goPage(p)"
      >
        {{ p }}
      </button>
      <button
        type="button"
        class="rounded-md border border-stone-300 px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="currentPage >= totalPages"
        @click="goPage(currentPage + 1)"
      >
        下一页
      </button>
    </nav>
  </div>
</template>
