import { API_BASE } from '../net/runtime'

const TOKEN_KEY = 'museguide-admin-token'

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export async function adminFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = getAdminToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (response.status === 401) clearAdminToken()
  return response
}

export async function requireAdminAccess(root: HTMLElement, onReady: () => void) {
  if (getAdminToken()) {
    try {
      const response = await adminFetch('/api/admin/session')
      if (response.ok) { onReady(); return }
    } catch { /* Show the form so the user can retry. */ }
    clearAdminToken()
  }
  root.innerHTML = `<form class="admin-login">
    <h2>管理员访问</h2>
    <p>请输入服务器配置的管理密码。</p>
    <input name="password" type="password" autocomplete="current-password" required aria-label="管理密码" />
    <button type="submit">进入</button>
    <p role="status"></p>
  </form>`
  const form = root.querySelector('form')!
  const status = form.querySelector('[role="status"]')!
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const input = form.querySelector('input')!
    sessionStorage.setItem(TOKEN_KEY, input.value)
    input.value = ''
    try {
      const response = await adminFetch('/api/admin/session')
      if (response.ok) { onReady(); return }
      clearAdminToken()
      status.textContent = response.status === 503 ? '服务器尚未启用管理功能。' : '管理密码无效。'
    } catch {
      clearAdminToken()
      status.textContent = '无法连接服务器，请检查服务状态后重试。'
    }
  })
}
