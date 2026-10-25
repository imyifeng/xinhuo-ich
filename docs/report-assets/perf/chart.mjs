#!/usr/bin/env node
/**
 * 压测对比图生成器（工单 #11）—— 读取 docs/perf/results/*.summary.json，
 * 生成开/关缓存对比的 SVG 图（吞吐 + P95 双面板），供报告第 6 章直接引用。
 *
 * 零依赖，Node 标准库；重生成：node docs/report-assets/perf/chart.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RESULTS = path.resolve(HERE, '..', '..', 'perf', 'results')

const THREADS = [50, 100, 200]
const load = (mode, n) =>
  JSON.parse(fs.readFileSync(path.join(RESULTS, `cache-${mode}-${n}.jtl.summary.json`), 'utf8'))

const data = THREADS.map((n) => ({ threads: n, on: load('on', n), off: load('off', n) }))
const maxTps = Math.max(...data.map((d) => Math.max(d.on.throughputRps, d.off.throughputRps)))
const maxP95 = Math.max(...data.map((d) => Math.max(d.on.p95Ms, d.off.p95Ms)))

// 版式参数
const W = 960
const PANEL_H = 300
const MARGIN = { top: 44, right: 24, bottom: 56, left: 84 }
const GAP = 40
const H = MARGIN.top + PANEL_H * 2 + GAP + MARGIN.bottom
const plotW = W - MARGIN.left - MARGIN.right
const ON_COLOR = '#d97706' // 缓存开（琥珀）
const OFF_COLOR = '#64748b' // 缓存关（石板灰）

const fmt = (v) => (v >= 1000 ? v.toLocaleString('en-US') : String(v))

function panel(y, title, unit, values, max, fmtVal, ratioMode) {
  const parts = []
  const plotH = PANEL_H - MARGIN.top - 0
  const innerH = plotH
  // 网格线（4 条）
  for (let i = 0; i <= 4; i++) {
    const gy = y + MARGIN.top + innerH - (innerH * i) / 4
    const val = (max * i) / 4
    parts.push(
      `<line x1="${MARGIN.left}" y1="${gy.toFixed(1)}" x2="${W - MARGIN.right}" y2="${gy.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<text x="${MARGIN.left - 10}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#475569">${fmtVal(val)}</text>`,
    )
  }
  // 分组柱
  const groupW = plotW / data.length
  const barW = 56
  data.forEach((d, i) => {
    const cx = MARGIN.left + groupW * i + groupW / 2
    const pairs = [
      { label: '关', v: values(d.off), color: OFF_COLOR },
      { label: '开', v: values(d.on), color: ON_COLOR },
    ]
    pairs.forEach((p, j) => {
      const h = Math.max(2, (p.v / max) * innerH)
      const bx = cx - barW - 6 + j * (barW + 12)
      const by = y + MARGIN.top + innerH - h
      parts.push(
        `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${p.color}" rx="3"/>`,
        `<text x="${(bx + barW / 2).toFixed(1)}" y="${(by - 6).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#1e293b">${fmtVal(p.v)}</text>`,
      )
    })
    parts.push(
      `<text x="${cx.toFixed(1)}" y="${y + MARGIN.top + innerH + 20}" text-anchor="middle" font-size="13" fill="#334155">${d.threads} 并发</text>`,
    )
    // 倍率标注：吞吐为 开/关（提升倍数），P95 为 关/开（降低倍数）
    const ratio = ratioMode === 'latency' ? values(d.off) / values(d.on) : values(d.on) / values(d.off)
    const label = ratioMode === 'latency' ? `↓ ${(ratio).toFixed(1)}×` : `${(ratio).toFixed(1)}×`
    parts.push(
      `<text x="${cx.toFixed(1)}" y="${y + MARGIN.top + innerH + 38}" text-anchor="middle" font-size="12" fill="#b45309">${label}</text>`,
    )
  })
  parts.push(
    `<text x="${MARGIN.left}" y="${y + 26}" font-size="15" font-weight="700" fill="#0f172a">${title}</text>`,
    `<text x="${W - MARGIN.right}" y="${y + 26}" text-anchor="end" font-size="12" fill="#64748b">${unit}</text>`,
  )
  return parts.join('\n  ')
}

const svg = `<!-- 由 docs/report-assets/perf/chart.mjs 从 docs/perf/results/*.summary.json 生成；重生成：node chart.mjs -->
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${W / 2}" y="24" text-anchor="middle" font-size="17" font-weight="700" fill="#0f172a">技艺条目详情接口：开 / 关缓存对比（JMeter，60s，0 错误）</text>
  ${panel(36, '吞吐（越高越好）', 'req/s', (d) => d.throughputRps, maxTps, (v) => fmt(Math.round(v)), 'throughput')}
  ${panel(36 + PANEL_H + GAP, 'P95 延迟（越低越好，↓ 为关闭缓存的延迟倍数）', 'ms', (d) => d.p95Ms, maxP95, (v) => String(Math.round(v)), 'latency')}
  <g transform="translate(${MARGIN.left},${H - 14})">
    <rect x="0" y="-11" width="12" height="12" fill="${OFF_COLOR}" rx="2"/>
    <text x="18" y="-1" font-size="12.5" fill="#334155">缓存关（CACHE_ENABLED=false，逐请求回源 PostgreSQL）</text>
    <rect x="470" y="-11" width="12" height="12" fill="${ON_COLOR}" rx="2"/>
    <text x="488" y="-1" font-size="12.5" fill="#334155">缓存开（CACHE_ENABLED=true，Redis cache-aside）</text>
  </g>
</svg>
`

fs.writeFileSync(path.join(HERE, 'comparison.svg'), svg)
console.log('[chart] 写出 comparison.svg（数据源 docs/perf/results/*.summary.json）')
for (const d of data) {
  console.log(
    `  ${d.threads} 并发：吞吐 ${fmt(d.on.throughputRps)} vs ${fmt(d.off.throughputRps)} req/s（${(d.on.throughputRps / d.off.throughputRps).toFixed(1)}×），P95 ${d.on.p95Ms} vs ${d.off.p95Ms} ms`,
  )
}
