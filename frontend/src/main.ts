import './style.css'
import 'mouse-follower/dist/mouse-follower.min.css'
import MouseFollower from 'mouse-follower'
import gsap from 'gsap'
import {
  renderApp,
  getUI,
  showCaption,
  hideCaption,
  updateStatus,
} from './app/ui'
import { createController } from './app/controller'
import { createAdminPage } from './app/admin'
import { createAnalyticsPage } from './app/analytics'
import { requireAdminAccess } from './app/adminAuth'
import { ASRClient } from './net/ASRClient'
import { API_BASE } from './net/runtime'

window.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia('(pointer: fine)').matches) {
    MouseFollower.registerGSAP(gsap)
    new MouseFollower({
      container: document.documentElement,
      speed: 0.45,
      skewing: 2,
      ease: 'expo.out',
    })
  }

  const app = document.getElementById('app')
  if (!app) return

  renderApp(app)

  const initLandingStateCarousel = () => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-landing-state-card]')
    )
    if (!cards.length) return

    let activeIndex = 0
    const layoutCards = () => {
      cards.forEach((card, index) => {
        const offset = (index - activeIndex + cards.length) % cards.length
        card.classList.toggle('active', offset === 0)
        gsap.to(card, {
          x: offset * 22,
          y: offset * 14,
          scale: 1 - offset * 0.06,
          opacity: offset > 2 ? 0 : 1 - offset * 0.2,
          rotate: offset === 0 ? 0 : offset * -2.5,
          zIndex: cards.length - offset,
          duration: 0.78,
          ease: 'power3.out',
        })
      })
    }

    layoutCards()
    window.setInterval(() => {
      activeIndex = (activeIndex + 1) % cards.length
      layoutCards()
    }, 2300)

    document.getElementById('landingStateCarousel')?.addEventListener('mouseenter', () => {
      gsap.to(cards[activeIndex], {
        scale: 1.04,
        duration: 0.28,
        ease: 'power2.out',
      })
    })
    document.getElementById('landingStateCarousel')?.addEventListener('mouseleave', layoutCards)
  }

  initLandingStateCarousel()

  const initLandingHorizontalShowcase = () => {
    const viewport = document.querySelector<HTMLElement>('.landing-horizontal-viewport')
    const track = document.querySelector<HTMLElement>('[data-horizontal-track]')
    if (!viewport || !track || window.matchMedia('(max-width: 1100px)').matches) return

    const maxScrollLeft = () => Math.max(0, track.scrollWidth - viewport.clientWidth)

    viewport.addEventListener('wheel', (event) => {
      const max = maxScrollLeft()
      if (!max) return

      const goingRight = event.deltaY > 0
      const goingLeft = event.deltaY < 0
      const atStart = viewport.scrollLeft <= 1
      const atEnd = viewport.scrollLeft >= max - 1

      if ((goingRight && !atEnd) || (goingLeft && !atStart)) {
        event.preventDefault()
        viewport.scrollLeft = Math.min(
          max,
          Math.max(0, viewport.scrollLeft + event.deltaY * 4.2)
        )
      }
    })
  }

  initLandingHorizontalShowcase()

  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <footer class="chatbar">
        <div class="progress-proof" id="progressProof"></div>
        <div class="suggestion-row" id="suggestionRow"></div>
        <div class="caption" id="caption">
          <p id="captionText"></p>
        </div>
        <div class="chat-inner">
          <button id="startGuide" class="chat-start">开始导览</button>

          <input
            id="input"
            class="chat-input"
            placeholder="输入问题，或说「好」继续…"
          />

          <button id="voice" class="chat-voice" title="语音输入">
            <span class="voice-dot"></span>
            <span class="voice-wave">
              <i></i><i></i><i></i><i></i>
            </span>
          </button>

          <button id="liveAvatarInterrupt" class="chat-interrupt" type="button" disabled>
            打断
          </button>

          <button id="send" class="chat-send">发送</button>
        </div>
      </footer>
    `
  )

  const ui = getUI()
  const controller = createController(ui)
  const navbar = document.querySelector<HTMLElement>('.navbar')
  const navGlass = document.querySelector<HTMLElement>('.navbar-glass')
  const updateNavChrome = () => {
    const missionTop = ui.landingPage
      ?.querySelector<HTMLElement>('.landing-mission')
      ?.getBoundingClientRect().top
    const byMissionPosition = typeof missionTop === 'number' && missionTop < 96
    const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY ?? 0
    const onLandingContent = document.body.classList.contains('mode-landing')
      && (byMissionPosition || scrollTop > 80)
    document.body.classList.toggle('nav-over-content', onLandingContent)
    document.body.dataset.navGlass = onLandingContent ? 'on' : 'off'
    navbar?.classList.toggle('nav-over-content', onLandingContent)
    navGlass?.classList.toggle('nav-over-content', onLandingContent)
  }

  const pages: Record<string, HTMLElement | null> = {
    landing: ui.landingPage,
    home: ui.homePage,
    collections: ui.collectionsPage,
    analytics: ui.analyticsPage,
    admin: ui.adminPage,
  }

  let collectionsLoaded = false
  let routeLoaded = false
  let adminLoaded = false
  let analyticsLoaded = false
  let liveDemoPrepared = false

  const renderCollections = (data: any) => {
    const zones = (data.zones || []).filter(
      (z: any) => z.visibility?.collections !== false
    )
    return zones.map((z: any) => {
      const loc = z.location || {}
      const locParts = [loc.floor, loc.area].filter(Boolean).join(' · ')
      const exhibits = (z.exhibits || []).map((e: any) => {
        const alias = (e.aliases || []).slice(0, 3).join(' / ')
        const img = e.image ? `<img class="exhibit-thumb" src="${e.image}" alt="${e.name}" />` : ''
        return `
          <div class="exhibit-card">
            ${img}
            <div class="exhibit-title">${e.name}</div>
            <div class="exhibit-meta">${[e.era, e.origin, e.material].filter(Boolean).join(' · ')}</div>
            <div class="exhibit-desc">${e.description || ''}</div>
            ${alias ? `<div class="exhibit-alias">别名：${alias}</div>` : ''}
          </div>
        `
      }).join('')

      return `
        <section class="zone-card">
          <div class="zone-header">
            <div class="zone-name">${z.name}</div>
            <div class="zone-loc">${locParts}</div>
          </div>
          <div class="zone-intro">${z.intro || ''}</div>
          <div class="exhibit-grid">${exhibits}</div>
        </section>
      `
    }).join('')
  }

  const loadCollections = async () => {
    if (collectionsLoaded || !ui.collectionsRoot) return
    const res = await fetch(`${API_BASE}/api/domain_prior`)
    const data = await res.json()
    ui.collectionsRoot.innerHTML = renderCollections(data)
    collectionsLoaded = true
  }

  const floorOrder = (floor: string) => {
    if (!floor) return 99
    if (floor.includes('展馆二层')) return -100
    if (floor.includes('展馆一层')) return -90
    if (floor.includes('地下一层')) return 10
    if (floor.includes('地下二层')) return 20
    const match = floor.match(/B(\\d+)/i)
    if (match) return -parseInt(match[1], 10)
    const level = floor.match(/(\\d+)/)
    if (level) return parseInt(level[1], 10)
    return 50
  }

  type RouteNode = { zone: any; floor: string; area: string }

  const renderRoute = (data: any) => {
    const zones = (data.zones || []).filter(
      (z: any) => z.visibility?.route !== false
    )
    const withLoc: RouteNode[] = zones.map((z: any) => {
      const loc = z.location || {}
      return {
        zone: z,
        floor: loc.floor || '未标注楼层',
        area: loc.area || '未标注区域',
      }
    })

    withLoc.sort((a, b) => {
      const f = floorOrder(a.floor) - floorOrder(b.floor)
      if (f !== 0) return f
      return a.area.localeCompare(b.area, 'zh-Hans-CN')
    })

    const floors: Record<string, Record<string, any[]>> = {}
    for (const item of withLoc) {
      if (!floors[item.floor]) floors[item.floor] = {}
      if (!floors[item.floor][item.area]) floors[item.floor][item.area] = []
      floors[item.floor][item.area].push(item.zone)
    }

    const floorBlocks = Object.entries(floors).map(([floor, areas]) => {
      const areaNames = Object.keys(areas)
      const areaCols = areaNames.map((area, idx) => {
        const nodes = areas[area].map((z: any) => `
          <div class="map-node">
            <div class="map-node-title">${z.name}</div>
            <div class="map-node-meta">${area}</div>
          </div>
        `).join('')
        return `
          <div class="map-area">
            <div class="map-area-label">${area}</div>
            <div class="map-node-stack">${nodes}</div>
            ${idx < areaNames.length - 1 ? '<div class="map-connector"></div>' : ''}
          </div>
        `
      }).join('')

      return `
        <section class="map-floor">
          <div class="map-floor-label">${floor}</div>
          <div class="map-row">
            ${areaCols}
          </div>
        </section>
      `
    }).join('')

    return `
      <div class="map-shell">
        ${floorBlocks || '<div class="map-empty">暂无路线数据</div>'}
      </div>
    `
  }

  const loadRoute = async () => {
    if (routeLoaded || !ui.routeRoot) return
    const res = await fetch(`${API_BASE}/api/domain_prior`)
    const data = await res.json()
    ui.routeRoot.innerHTML = renderRoute(data)
    routeLoaded = true
  }

  const loadAdmin = async () => {
    if (adminLoaded || !ui.adminRoot) return
    requireAdminAccess(ui.adminRoot, () => {
      createAdminPage(ui.adminRoot, {
        onContentSaved: async () => {
          collectionsLoaded = false
          routeLoaded = false
          analyticsLoaded = false
          await controller.reloadContentConfig()
          if (!ui.collectionsPage.classList.contains('hidden')) {
            await loadCollections()
            await loadRoute()
          }
          if (ui.routePage && !ui.routePage.classList.contains('hidden')) {
            await loadRoute()
          }
          if (!ui.analyticsPage.classList.contains('hidden')) {
            await loadAnalytics()
          }
        },
      })
      adminLoaded = true
    })
  }

  const loadAnalytics = async () => {
    if (analyticsLoaded || !ui.analyticsRoot) return
    requireAdminAccess(ui.analyticsRoot, async () => {
      await createAnalyticsPage(ui.analyticsRoot)
      analyticsLoaded = true
    })
  }

  const showPage = async (page: string) => {
    document.body.classList.toggle('mode-landing', page === 'landing')
    if (page !== 'landing') {
      document.body.classList.remove('nav-over-content')
      document.body.dataset.navGlass = 'off'
      navbar?.classList.remove('nav-over-content')
      navGlass?.classList.remove('nav-over-content')
    }
    if (page === 'home') {
      document.body.classList.add('mode-home')
    } else {
      document.body.classList.remove('mode-home')
    }
    Object.entries(pages).forEach(([key, el]) => {
      if (!el) return
      if (key === page) {
        el.classList.remove('hidden', 'exiting', 'active')
        // force reflow to restart transition when returning
        void el.offsetWidth
        window.requestAnimationFrame(() => {
          el.classList.add('active')
        })
        return
      }
      if (!el.classList.contains('hidden')) {
        el.classList.remove('active')
        el.classList.add('exiting')
        window.setTimeout(() => {
          el.classList.add('hidden')
          el.classList.remove('exiting')
        }, 360)
      } else {
        el.classList.remove('active', 'exiting')
      }
    })
    ui.navLinks?.forEach(link => {
      link.classList.toggle('active', link.dataset.page === page)
    })
    if (page === 'collections') {
      await loadCollections()
      await loadRoute()
    }
    if (page === 'admin') {
      await loadAdmin()
    }
    if (page === 'analytics') {
      await loadAnalytics()
    }
    if (page === 'home' && !liveDemoPrepared) {
      liveDemoPrepared = true
      controller.preconnectLiveAvatar()
    }
    updateNavChrome()
  }

  showPage('landing')
  window.setTimeout(updateNavChrome, 0)
  window.setTimeout(updateNavChrome, 200)
  window.addEventListener('scroll', updateNavChrome, { passive: true })
  document.addEventListener('scroll', updateNavChrome, { passive: true, capture: true })
  document.body.addEventListener('scroll', updateNavChrome, { passive: true })
  document.documentElement.addEventListener('scroll', updateNavChrome, { passive: true })
  window.addEventListener('resize', updateNavChrome)
  const navChromeLoop = () => {
    updateNavChrome()
    window.requestAnimationFrame(navChromeLoop)
  }
  window.requestAnimationFrame(navChromeLoop)

  ui.navLinks?.forEach(link => {
    link.onclick = async (e) => {
      e.preventDefault()
      const page = link.dataset.page || 'home'
      await showPage(page)
    }
  })

  document
    .querySelectorAll<HTMLElement>('[data-jump-page]')
    .forEach(el => {
      el.addEventListener('click', async () => {
        await showPage(el.dataset.jumpPage || 'home')
      })
    })

  document
    .querySelectorAll<HTMLElement>('[data-scroll-target]')
    .forEach(el => {
      el.addEventListener('click', () => {
        const target = document.getElementById(el.dataset.scrollTarget || '')
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })

  /* ============================
     键盘输入
     ============================ */
  ui.startGuideBtn.onclick = () => {
    controller.submitUserInput(controller.getStartGuideCommand(), 'start')
  }

  ui.sendBtn.onclick = () => {
    const text = ui.input.value.trim()
    if (!text) return

    controller.submitUserInput(text, 'text')
    ui.input.value = ''
  }

  /* ============================
     语音输入（点一下开始，再点一下直接发 LLM）
     ============================ */
  const asr = new ASRClient()
  let recording = false

  ui.voiceBtn.onclick = async () => {
    /* ---------- 开始录音 ---------- */
    if (!recording) {
      recording = true

      console.log('[UI] start recording')

      ui.voiceBtn.classList.add('listening')

      // UI 状态
      updateStatus(ui, 'Listening...', 'listening')
      hideCaption(ui)

      asr.setOnPartial((text) => {
        if (!recording) return
        if (text) showCaption(ui, text, 'partial')
      })
      asr.start()
      return
    }

    /* ---------- 停止录音 & 直接送 LLM ---------- */
    recording = false

    console.log('[UI] stop recording')

    ui.voiceBtn.classList.remove('listening')

    updateStatus(ui, 'Recognizing...', 'idle')

    // 🔥 等 ASR 最终文本
    const text = await asr.stopAndGetFinalText()

    console.log('[UI] ASR final text:', text)

    if (!text) {
      updateStatus(ui, 'Idle', 'idle')
      return
    }

    // 1️⃣ 显示字幕（你已经有的 Caption）
    showCaption(ui, text, 'final')

    // 2️⃣ 状态反馈
    updateStatus(ui, 'Recognized', 'idle')

    // 3️⃣ 👈 直接发给 LLM（不需要再点发送）
    controller.submitUserInput(text, 'voice')
  }
})
