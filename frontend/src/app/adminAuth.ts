import { API_BASE } from '../net/runtime'

const ADMIN_TOKEN_KEY = 'museguide_admin_token'

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

export function adminFetch(path: string, init: RequestInit = {}) {
  const token = getAdminToken()
  const headers = new Headers(init.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
}

async function validateAdminToken() {
  if (!getAdminToken()) return false
  try {
    const res = await adminFetch('/api/admin/session')
    if (res.ok) return true
  } catch {
    // fall through to login
  }
  clearAdminToken()
  return false
}

async function loginAdmin(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) return false
  const data = await res.json()
  if (!data?.token) return false
  window.localStorage.setItem(ADMIN_TOKEN_KEY, String(data.token))
  return true
}

function renderAdminLogin(root: HTMLElement, onSuccess: () => void) {
  root.innerHTML = `
    <div class="admin-login-shell">
      <section class="admin-login-card">
        <div class="admin-login-kicker">MuseGuide Admin</div>
        <h2>后台访问验证</h2>
        <p>请输入管理员密码后继续访问内容后台与数据看板。</p>
        <form class="admin-login-form" id="adminLoginForm">
          <input
            class="admin-login-input"
            id="adminUsernameInput"
            type="text"
            autocomplete="username"
            placeholder="账号"
            value="admin"
          />
          <input
            class="admin-login-input"
            id="adminPasswordInput"
            type="password"
            autocomplete="current-password"
            placeholder="管理员密码"
          />
          <button class="admin-login-btn" type="submit">进入后台</button>
        </form>
        <div class="admin-login-error" id="adminLoginError"></div>
      </section>
    </div>
  `

  const form = root.querySelector<HTMLFormElement>('#adminLoginForm')
  const usernameInput = root.querySelector<HTMLInputElement>('#adminUsernameInput')
  const input = root.querySelector<HTMLInputElement>('#adminPasswordInput')
  const error = root.querySelector<HTMLElement>('#adminLoginError')
  input?.focus()
  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const username = usernameInput?.value.trim() || 'admin'
    const password = input?.value.trim() || ''
    if (!username || !password) {
      if (error) error.textContent = '请先输入账号和密码。'
      return
    }
    if (error) error.textContent = '正在验证…'
    const ok = await loginAdmin(username, password)
    if (!ok) {
      if (error) error.textContent = '密码不正确，或后台认证服务未配置。'
      return
    }
    onSuccess()
  })
}

export async function requireAdminAccess(root: HTMLElement, onReady: () => void) {
  if (await validateAdminToken()) {
    onReady()
    return
  }
  renderAdminLogin(root, onReady)
}
