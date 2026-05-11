import { API_BASE } from '../net/runtime'

export function clearAdminToken() {
  return undefined
}

export function getAdminToken() {
  return ''
}

export function adminFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, init)
}

export async function requireAdminAccess(_root: HTMLElement, onReady: () => void) {
  onReady()
}
