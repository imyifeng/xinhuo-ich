#!/usr/bin/env node
/**
 * JTL（CSV）汇总脚本：docs/perf 结果归档的确定性计算器（工单 #9，报告第 6 章素材）。
 *
 * 用法：node summarize.mjs <results.jtl> [<results.jtl> ...]
 * 输出：与输入同名的 .summary.json（吞吐、均值、P50/P90/P95/P99、错误率、样本数）。
 *
 * JMeter 默认 CSV 格式列：
 * timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,
 * failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const jtlFiles = process.argv.slice(2)
if (jtlFiles.length === 0) {
  console.error('用法：node summarize.mjs <results.jtl> [...]')
  process.exit(1)
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

async function summarize(jtlPath) {
  const rl = createInterface({ input: createReadStream(jtlPath, 'utf8'), crlfDelay: Infinity })
  let header = null
  const elapsed = []
  let ok = 0
  let firstTs = Number.POSITIVE_INFINITY
  let lastTs = 0
  const codes = new Map()

  for await (const line of rl) {
    if (line.trim() === '') continue
    const cols = line.split(',')
    if (header === null) {
      header = cols
      continue
    }
    const row = Object.fromEntries(header.map((name, i) => [name, cols[i]]))
    const ts = Number(row.timeStamp)
    firstTs = Math.min(firstTs, ts)
    lastTs = Math.max(lastTs, ts)
    elapsed.push(Number(row.elapsed))
    const success = row.success === 'true'
    if (success) ok += 1
    codes.set(row.responseCode, (codes.get(row.responseCode) ?? 0) + 1)
  }

  elapsed.sort((a, b) => a - b)
  const samples = elapsed.length
  const windowMs = Math.max(1, lastTs - firstTs)
  const responseCodes = Object.fromEntries([...codes.entries()].sort())
  return {
    file: jtlPath,
    samples,
    windowSeconds: Number((windowMs / 1000).toFixed(1)),
    throughputRps: Number((samples / (windowMs / 1000)).toFixed(1)),
    errorRatePct: Number((((samples - ok) / samples) * 100).toFixed(3)),
    meanMs: Number((elapsed.reduce((sum, v) => sum + v, 0) / samples).toFixed(1)),
    p50Ms: percentile(elapsed, 50),
    p90Ms: percentile(elapsed, 90),
    p95Ms: percentile(elapsed, 95),
    p99Ms: percentile(elapsed, 99),
    maxMs: elapsed[samples - 1],
    responseCodes,
  }
}

const results = []
for (const path of jtlFiles) {
  results.push(await summarize(path))
}

const outDir = dirname(jtlFiles[0])
for (const r of results) {
  const outPath = join(outDir, `${r.file.split('/').pop()}.summary.json`)
  console.log(JSON.stringify(r, null, 2))
  const { writeFileSync } = await import('node:fs')
  writeFileSync(outPath, `${JSON.stringify(r, null, 2)}\n`)
  console.log(`[summarize] 已写出 ${outPath}`)
}
