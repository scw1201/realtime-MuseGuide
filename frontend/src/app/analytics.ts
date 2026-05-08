import type {
  AnalyticsNamedCount,
  AnalyticsResponse,
  AnalyticsZoneStageRow,
} from '../net/types'
import { adminFetch } from './adminAuth'

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderMetricCard(label: string, value: string | number, hint: string) {
  return `
    <div class="analytics-card analytics-card-metric">
      <div class="analytics-kicker">${escapeHtml(label)}</div>
      <div class="analytics-metric">${escapeHtml(String(value))}</div>
      <div class="analytics-hint">${escapeHtml(hint)}</div>
    </div>
  `
}

function renderRankList(title: string, subtitle: string, items: AnalyticsNamedCount[], emptyText: string) {
  const content = items.length
    ? items.map(item => `
        <div class="analytics-rank-item">
          <div class="analytics-rank-name">${escapeHtml(item.name)}</div>
          <div class="analytics-rank-count">${escapeHtml(String(item.count))}</div>
        </div>
      `).join('')
    : `<div class="analytics-empty">${escapeHtml(emptyText)}</div>`

  return `
    <section class="analytics-card">
      <div class="analytics-section-head">
        <div>
          <div class="analytics-section-title">${escapeHtml(title)}</div>
          <div class="analytics-section-sub">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <div class="analytics-rank-list">
        ${content}
      </div>
    </section>
  `
}

function renderBars(title: string, subtitle: string, items: AnalyticsNamedCount[], emptyText: string) {
  const maxCount = Math.max(...items.map(item => item.count), 1)
  const content = items.length
    ? items.map(item => {
        const width = Math.max(8, Math.round((item.count / maxCount) * 100))
        return `
          <div class="analytics-bar-row">
            <div class="analytics-bar-label">${escapeHtml(item.name)}</div>
            <div class="analytics-bar-track">
              <div class="analytics-bar-fill" style="width:${width}%"></div>
            </div>
            <div class="analytics-bar-value">${escapeHtml(String(item.count))}</div>
          </div>
        `
      }).join('')
    : `<div class="analytics-empty">${escapeHtml(emptyText)}</div>`

  return `
    <section class="analytics-card">
      <div class="analytics-section-head">
        <div>
          <div class="analytics-section-title">${escapeHtml(title)}</div>
          <div class="analytics-section-sub">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <div class="analytics-bars">
        ${content}
      </div>
    </section>
  `
}

function renderZoneStageMatrix(rows: AnalyticsZoneStageRow[]) {
  const stageNames = Array.from(new Set(rows.flatMap(row => Object.keys(row).filter(key => key !== 'zone'))))
  const header = stageNames.map(stage => `<th>${escapeHtml(stage)}</th>`).join('')
  const body = rows.length
    ? rows.map(row => `
        <tr>
          <td>${escapeHtml(String(row.zone || ''))}</td>
          ${stageNames.map(stage => `<td>${escapeHtml(String(row[stage] || 0))}</td>`).join('')}
        </tr>
      `).join('')
    : `<tr><td colspan="${stageNames.length + 1}">暂无阶段流转数据</td></tr>`

  return `
    <section class="analytics-card analytics-card-full">
      <div class="analytics-section-head">
        <div>
          <div class="analytics-section-title">展区 × 导览阶段</div>
          <div class="analytics-section-sub">帮助看出哪些展区更多停留在引路、概览或深入讲解阶段</div>
        </div>
      </div>
      <div class="analytics-table-wrap">
        <table class="analytics-table">
          <thead>
            <tr>
              <th>展区</th>
              ${header}
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderRecentSessions(data: AnalyticsResponse) {
  const items = data.recent_sessions.length
    ? data.recent_sessions.map(session => `
        <div class="analytics-session-item">
          <div class="analytics-session-top">
            <div class="analytics-session-id">${escapeHtml(session.session_id)}</div>
            <div class="analytics-session-time">${escapeHtml(session.last_ts || '')}</div>
          </div>
          <div class="analytics-session-meta">
            <span>人物：${escapeHtml(session.persona_id || '—')}</span>
            <span>展区：${escapeHtml(session.current_zone || '—')}</span>
            <span>阶段：${escapeHtml(session.guide_stage || '—')}</span>
          </div>
          <div class="analytics-session-text">${escapeHtml(session.last_user_text || '—')}</div>
        </div>
      `).join('')
    : `<div class="analytics-empty">暂无最近会话数据</div>`

  return `
    <section class="analytics-card analytics-card-full">
      <div class="analytics-section-head">
        <div>
          <div class="analytics-section-title">最近会话</div>
          <div class="analytics-section-sub">快速回看最近导览发生了什么，适合现场演示后复盘</div>
        </div>
      </div>
      <div class="analytics-session-list">${items}</div>
    </section>
  `
}

function renderDashboard(data: AnalyticsResponse) {
  return `
    <div class="analytics-shell">
      <div class="analytics-overview">
        ${renderMetricCard('总会话数', data.overview.total_sessions, '统计到的 session 数量')}
        ${renderMetricCard('总请求数', data.overview.total_requests, '包含文本、语音、chip 与自动推进')}
        ${renderMetricCard('平均轮次/会话', data.overview.avg_turns_per_session, '每个会话平均发起了多少轮请求')}
        ${renderMetricCard('建议承接率', `${data.overview.suggestion_accept_rate}%`, '上一轮建议被确认执行的比例')}
        ${renderMetricCard('自动推进次数', data.overview.auto_advance_count, '系统 7 秒后自动推进的触发次数')}
      </div>

      <div class="analytics-grid">
        ${renderRankList('热门展区', '观众最常到达或停留的展区', data.top_zones, '暂无展区热度数据')}
        ${renderRankList('热门展品', '被聚焦或讲解最多的展品', data.top_exhibits, '暂无展品热度数据')}
        ${renderBars('导览阶段分布', '看系统更多停留在引路、概览还是深入讲解', data.guide_stage_counts, '暂无阶段分布数据')}
        ${renderBars('输入来源分布', '看用户更常用文字、语音、chip 还是自动推进', data.source_counts, '暂无来源分布数据')}
        ${renderBars('角色使用情况', '不同导览人物被使用的次数', data.persona_counts, '暂无人物分布数据')}
      </div>

      ${renderZoneStageMatrix(data.zone_stage_matrix)}
      ${renderRecentSessions(data)}
    </div>
  `
}

export async function createAnalyticsPage(root: HTMLElement) {
  root.innerHTML = `<div class="analytics-loading">正在加载数据看板…</div>`
  try {
    const res = await adminFetch('/api/admin/analytics')
    if (!res.ok) {
      throw new Error(`analytics failed: ${res.status}`)
    }
    const data = await res.json() as AnalyticsResponse
    root.innerHTML = renderDashboard(data)
  } catch {
    root.innerHTML = `<div class="analytics-error">数据看板加载失败，请确认后端服务已启动且日志文件可读取。</div>`
  }
}
