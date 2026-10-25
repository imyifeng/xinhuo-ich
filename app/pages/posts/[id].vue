<script setup lang="ts">
/**
 * 帖子详情（工单 #7 / 用户故事 9）：正文与评论公开可看，评论需登录（未登录引导登录）。
 */
interface CommentView {
  id: string
  content: string
  author: { id: number, displayName: string }
  createdAt: string
}

interface PostDetail {
  id: string
  title: string
  content: string
  author: { id: number, displayName: string }
  comments: CommentView[]
  createdAt: string
}

interface AuthUser {
  id: number
  username: string
  displayName: string
  role: string
}

const route = useRoute()

const { data: post, error, refresh: refreshPost } = await useFetch<PostDetail>(`/api/posts/${route.params.id}`)

if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: '帖子不存在', fatal: true })
}

// 登录态：与 AppHeader 共用 'auth-me' 数据（useFetch 同 key 去重）
const { data: user } = await useFetch<AuthUser | null>('/api/auth/me', {
  key: 'auth-me',
  default: () => null,
})

const commentContent = ref('')
const submitting = ref(false)
const submitError = ref('')

async function onSubmitComment() {
  submitError.value = ''
  submitting.value = true
  try {
    await $fetch(`/api/posts/${post.value!.id}/comments`, {
      method: 'POST',
      body: { content: commentContent.value },
    })
    commentContent.value = ''
    await refreshPost()
  }
  catch (err) {
    submitError.value = apiErrorMessage(err)
  }
  finally {
    submitting.value = false
  }
}

useHead({ title: `${post.value.title} · 薪火`, htmlAttrs: { lang: 'zh-CN' } })

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <article v-if="post" class="mx-auto max-w-3xl px-6 py-10">
    <!-- 正文 -->
    <header>
      <h1 class="text-2xl font-bold leading-snug">{{ post.title }}</h1>
      <p class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-400">
        <span class="text-stone-600">{{ post.author.displayName }}</span>
        <span>{{ formatTime(post.createdAt) }}</span>
      </p>
    </header>

    <div class="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700">{{ post.content }}</div>

    <!-- 评论 -->
    <section class="mt-10 border-t border-stone-200 pt-6">
      <h2 class="text-lg font-semibold">评论（{{ post.comments.length }}）</h2>

      <!-- 评论框：未登录引导登录 -->
      <div v-if="user" class="mt-4">
        <textarea
          v-model="commentContent"
          rows="3"
          maxlength="2000"
          placeholder="写下你的评论（1~2000 字）"
          class="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-orange-500"
        />
        <p v-if="submitError" class="mt-2 text-sm text-red-600">{{ submitError }}</p>
        <button
          type="button"
          :disabled="submitting"
          class="mt-3 rounded-lg bg-orange-600 px-4 py-1.5 text-sm text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          @click="onSubmitComment"
        >
          {{ submitting ? '发布中…' : '发表评论' }}
        </button>
      </div>
      <p v-else class="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
        想参与讨论？
        <NuxtLink to="/login" class="font-medium text-orange-600 hover:text-orange-700">登录</NuxtLink>
        或
        <NuxtLink to="/register" class="font-medium text-orange-600 hover:text-orange-700">注册</NuxtLink>
        后评论帖子。
      </p>

      <ul v-if="post.comments.length" class="mt-6 space-y-4">
        <li v-for="comment in post.comments" :key="comment.id" class="rounded-xl border border-stone-200 bg-white p-4">
          <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
            <span class="text-stone-600">{{ comment.author.displayName }}</span>
            <span>{{ formatTime(comment.createdAt) }}</span>
          </p>
          <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{{ comment.content }}</p>
        </li>
      </ul>
      <p v-else class="mt-6 rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">
        还没有评论，来抢沙发。
      </p>
    </section>

    <div class="mt-12 border-t border-stone-200 pt-6">
      <NuxtLink to="/community" class="text-sm text-orange-600 hover:text-orange-700">← 返回交流区</NuxtLink>
    </div>
  </article>
</template>
