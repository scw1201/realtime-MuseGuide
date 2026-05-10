// frontend/src/app/ui.ts

/* ============================
   Render
   ============================ */
export function renderApp(root: HTMLElement) {
  root.innerHTML = `
    <!-- 顶部导航 -->
    <header class="navbar">
      <div class="nav-inner">
        <div class="nav-brand">
          <img src="/museguide-logo.svg" class="nav-logo" alt="MuseGuide" />
        </div>
        <nav class="nav-links">
          <a href="#" class="nav-link active" data-page="landing">首页</a>
          <a href="#" class="nav-link" data-page="home">免费体验</a>
          <a href="#" class="nav-link" data-page="collections">展品预览</a>
          <a href="#" class="nav-link" data-page="analytics">数据看板</a>
          <a href="#" class="nav-link" data-page="admin">内容后台</a>
        </nav>
      </div>
    </header>

    <section class="landing-page page" id="landingPage">
      <div class="landing-video-shell" aria-hidden="true">
        <video
          class="landing-video"
          autoplay
          muted
          loop
          playsinline
        >
          <source src="/landing/concept.mp4?v=20260510" type="video/mp4" />
        </video>
        <div class="landing-video-overlay"></div>
        <div class="landing-content">
          <div class="landing-kicker">MuseGuide · Real-time AI Docent</div>
          <h1 class="landing-title">
            <img src="/museguide-logo.svg" class="landing-logo" alt="MuseGuide" />
          </h1>
          <p class="landing-subtitle">
            为博物馆而生的智能实时互动数字人导览
          </p>
          <div class="landing-actions">
            <button class="landing-cta primary" type="button" data-jump-page="home">
              <span class="landing-cta-text landing-cta-default">进入免费体验</span>
              <span class="landing-cta-text landing-cta-hover">进入交互原型</span>
            </button>
            <button class="landing-cta secondary" type="button" data-scroll-target="landingCapabilities">
              查看能力亮点
            </button>
          </div>
          <div class="landing-proof">
            <span>实时口型对齐</span>
            <span>状态视频调度</span>
            <span>馆方内容后台</span>
          </div>
        </div>
      </div>

      <section class="landing-mission" id="landingCapabilities">
        <p class="landing-mission-copy">
          <span class="landing-mission-line landing-mission-lead">为博物馆建立全新的导览基础设施：</span>
          <span class="landing-mission-line landing-mission-core">以<strong>数字导览员</strong>为核心的人形交互界面。</span>
        </p>
      </section>

      <section class="landing-product">
        <div class="landing-section-label">Product Features</div>
        <h2 class="landing-section-title">产品特性</h2>

        <div class="landing-feature-stack">
          <article class="landing-feature-card">
            <span class="capability-index">01</span>
            <h3>实时数字人讲解</h3>
            <p>接入实时口型链路，让 LLM 返回的话直接变成可听、可看的导览员表达。</p>
          </article>
          <article class="landing-feature-card landing-feature-dark">
            <span class="capability-index">02</span>
            <h3>多状态视频调度</h3>
            <p>问候、聚焦、细致讲解、待机等状态由导览语义驱动，减少“只会播一个视频”的机械感。</p>
          </article>
          <article class="landing-feature-card">
            <span class="capability-index">03</span>
            <h3>可维护内容中台</h3>
            <p>展区、展品、人物文案与数据看板保持在同一套系统里，方便馆方持续运营。</p>
          </article>
        </div>
      </section>
    </section>

    <!-- 主舞台区域 -->
    <main class="stage-wrap page hidden" id="homePage">
      <div class="stage-card" id="stageCard">
        <!-- 侧边人物栏 -->
        <aside class="persona-sidebar" id="personaSidebar">
          <div class="persona-header">
            <button class="persona-toggle" id="personaToggle" title="展开/收起">
              ☰
            </button>
            <div class="sidebar-tabs" id="sidebarTabs">
              <button class="sidebar-tab active" id="personaTab" data-panel="personas" type="button">
                人物选择
              </button>
              <button class="sidebar-tab" id="progressTab" data-panel="progress" type="button">
                导览进程
              </button>
            </div>
          </div>
          <div class="sidebar-panel active" id="personaSidebarPanel">
            <div class="persona-list" id="personaList"></div>
          </div>
          <div class="sidebar-panel" id="progressSidebarPanel">
            <div class="progress-root" id="progressRoot"></div>
          </div>
        </aside>

        <div class="progress-preview hidden" id="progressPreview">
          <div class="progress-preview-label" id="progressPreviewLabel">当前导览预览</div>
          <div class="progress-preview-title" id="progressPreviewTitle">尚未进入展区</div>
          <img class="progress-preview-image hidden" id="progressPreviewImage" alt="当前展区或展品预览" />
          <div class="progress-preview-empty" id="progressPreviewEmpty">开始导览后，这里会显示当前展区或展品图片。</div>
        </div>

        <!-- 当前人物信息 -->
        <section class="persona-panel" id="personaPanel">
          <img id="personaAvatar" class="persona-avatar" />
          <div class="persona-meta">
            <div class="persona-name" id="personaName"></div>
            <div class="persona-role" id="personaRole"></div>
            <div class="persona-bio" id="personaBio"></div>
          </div>
        </section>

        <!-- 导览实况 -->
        <section class="context-panel" id="contextPanel">
          <div class="context-title">导览实况</div>
          <div class="context-line">
            <span class="context-label">当前位置</span>
            <span class="context-text" id="contextZone">展馆前台</span>
          </div>
          <div class="context-line">
            <span class="context-label">导览阶段</span>
            <span class="context-text" id="contextStage">准备阶段</span>
          </div>
          <div class="context-line">
            <span class="context-label">关注展品</span>
            <span class="context-text" id="contextAnchor">—</span>
          </div>
          <div class="context-line context-hint" id="contextHint" style="display:none">
            <span class="context-label">待执行</span>
            <span class="context-text" id="contextPathHint">—</span>
          </div>
          <div class="context-map">
            <img id="contextMap" class="context-map-img" alt="当前位置示意图" />
          </div>
        </section>

        <div class="avatar-frame" id="avatarFrame">
          <div class="liveavatar-panel" id="liveAvatarPanel">
            <button class="liveavatar-toggle" id="liveAvatarToggle" type="button">
              接入实时数字人
            </button>
            <span class="liveavatar-status" id="liveAvatarStatus">未连接</span>
            <button class="liveavatar-interrupt" id="liveAvatarInterrupt" type="button">
              打断
            </button>
            <button class="liveavatar-log-toggle" id="liveAvatarLogToggle" type="button">
              log
            </button>
          </div>
          <div class="liveavatar-log hidden" id="liveAvatarLog"></div>
          <video
            id="avatar"
            autoplay
            muted
            loop
            playsinline
          ></video>
          <div class="stage-announce" id="stageAnnounce"></div>
        </div>

        <!-- 状态徽标 -->
        <div class="badge idle" id="badge">
          <span class="badge-dot"></span>
          <div class="badge-texts">
            <span id="badgeText"></span>
            <span id="badgeDesc">静待观众</span>
          </div>
        </div>
      </div>
    </main>

    <section class="collections-page page hidden" id="collectionsPage">
      <div class="route-layout exhibit-preview-route">
        <aside class="route-floor">
          <img src="/imgs/floor/floors_all.png" alt="展馆楼层总览" />
        </aside>
        <div class="route-root" id="routeRoot"></div>
      </div>
      <div class="collections-root" id="collectionsRoot"></div>
    </section>

    <section class="admin-page page hidden" id="adminPage">
      <div class="admin-root" id="adminRoot"></div>
    </section>

    <section class="analytics-page page hidden" id="analyticsPage">
      <div class="analytics-root" id="analyticsRoot"></div>
    </section>

  `
}

/* ============================
   UI Getter
   ============================ */
export function getUI() {
  return {
    // video
    video: document.getElementById('avatar') as HTMLVideoElement,
    liveAvatarToggle: document.getElementById('liveAvatarToggle') as HTMLButtonElement,
    liveAvatarInterrupt: document.getElementById('liveAvatarInterrupt') as HTMLButtonElement,
    liveAvatarStatus: document.getElementById('liveAvatarStatus') as HTMLSpanElement,
    liveAvatarLogToggle: document.getElementById('liveAvatarLogToggle') as HTMLButtonElement,
    liveAvatarLog: document.getElementById('liveAvatarLog') as HTMLDivElement,
    landingPage: document.getElementById('landingPage') as HTMLElement,
    stageCard: document.getElementById('stageCard') as HTMLDivElement,
    avatarFrame: document.getElementById('avatarFrame') as HTMLDivElement,
    personaSidebar: document.getElementById('personaSidebar') as HTMLDivElement,
    personaToggle: document.getElementById('personaToggle') as HTMLButtonElement,
    personaTab: document.getElementById('personaTab') as HTMLButtonElement,
    progressTab: document.getElementById('progressTab') as HTMLButtonElement,
    personaSidebarPanel: document.getElementById('personaSidebarPanel') as HTMLDivElement,
    progressSidebarPanel: document.getElementById('progressSidebarPanel') as HTMLDivElement,
    personaList: document.getElementById('personaList') as HTMLDivElement,
    progressRoot: document.getElementById('progressRoot') as HTMLDivElement,
    progressPreview: document.getElementById('progressPreview') as HTMLDivElement,
    progressPreviewLabel: document.getElementById('progressPreviewLabel') as HTMLDivElement,
    progressPreviewTitle: document.getElementById('progressPreviewTitle') as HTMLDivElement,
    progressPreviewImage: document.getElementById('progressPreviewImage') as HTMLImageElement,
    progressPreviewEmpty: document.getElementById('progressPreviewEmpty') as HTMLDivElement,
    personaPanel: document.getElementById('personaPanel') as HTMLDivElement,
    personaAvatar: document.getElementById('personaAvatar') as HTMLImageElement,
    personaName: document.getElementById('personaName') as HTMLDivElement,
    personaRole: document.getElementById('personaRole') as HTMLDivElement,
    personaBio: document.getElementById('personaBio') as HTMLDivElement,
    contextPanel: document.getElementById('contextPanel') as HTMLDivElement,
    contextMap: document.getElementById('contextMap') as HTMLImageElement,
    contextZone: document.getElementById('contextZone') as HTMLSpanElement,
    contextStage: document.getElementById('contextStage') as HTMLSpanElement,
    contextAnchor: document.getElementById('contextAnchor') as HTMLSpanElement,
    contextHint: document.getElementById('contextHint') as HTMLDivElement,
    contextPathHint: document.getElementById('contextPathHint') as HTMLSpanElement,
    navLinks: document.querySelectorAll('.nav-link') as NodeListOf<HTMLAnchorElement>,
    homePage: document.getElementById('homePage') as HTMLElement,
    routePage: document.getElementById('routePage') as HTMLElement | null,
    routeRoot: document.getElementById('routeRoot') as HTMLDivElement,
    collectionsPage: document.getElementById('collectionsPage') as HTMLElement,
    collectionsRoot: document.getElementById('collectionsRoot') as HTMLDivElement,
    analyticsPage: document.getElementById('analyticsPage') as HTMLElement,
    analyticsRoot: document.getElementById('analyticsRoot') as HTMLDivElement,
    adminPage: document.getElementById('adminPage') as HTMLElement,
    adminRoot: document.getElementById('adminRoot') as HTMLDivElement,

    // input
    input: document.getElementById('input') as HTMLInputElement,
    sendBtn: document.getElementById('send') as HTMLButtonElement,
    startGuideBtn: document.getElementById('startGuide') as HTMLButtonElement,
    progressProof: document.getElementById('progressProof') as HTMLDivElement,
    suggestionRow: document.getElementById('suggestionRow') as HTMLDivElement,

    // 🎤 voice
    voiceBtn: document.getElementById('voice') as HTMLButtonElement,

    // caption
    caption: document.getElementById('caption') as HTMLDivElement,
    captionText: document.getElementById('captionText') as HTMLParagraphElement,

    // status
    badge: document.getElementById('badge') as HTMLDivElement,
    badgeText: document.getElementById('badgeText') as HTMLSpanElement,
    badgeDesc: document.getElementById('badgeDesc') as HTMLSpanElement,
  }
}

/* ============================
   UI Mutators
   ============================ */
export function updateStatus(
  ui: ReturnType<typeof getUI>,
  _text: string,
  state?: string,
  desc?: string
) {
  if (state && ui.badge && ui.badgeText) {
    ui.badgeText.textContent = state
    ui.badge.className = `badge ${state.toLowerCase()}`
  }

  if (desc && ui.badgeDesc) {
    ui.badgeDesc.textContent = desc
  }
}

export function showCaption(
  ui: ReturnType<typeof getUI>,
  text: string,
  mode: 'partial' | 'final' = 'final'
) {
  if (!ui.caption || !ui.captionText) return

  ui.captionText.textContent = text
  ui.caption.classList.add('show')
  ui.caption.classList.toggle('partial', mode === 'partial')
  ui.caption.classList.toggle('final', mode === 'final')
  const chatbar = ui.caption.closest('.chatbar')
  if (chatbar) {
    chatbar.classList.add('has-caption')
  }
}

export function hideCaption(ui: ReturnType<typeof getUI>) {
  if (!ui.caption) return
  ui.caption.classList.remove('show')
  ui.caption.classList.remove('partial', 'final')
  const chatbar = ui.caption.closest('.chatbar')
  if (chatbar) {
    chatbar.classList.remove('has-caption')
  }
}

export function showProgressProof(
  ui: ReturnType<typeof getUI>,
  text: string
) {
  if (!ui.progressProof) return
  ui.progressProof.textContent = text
  ui.progressProof.classList.add('show')
}

export function hideProgressProof(ui: ReturnType<typeof getUI>) {
  if (!ui.progressProof) return
  ui.progressProof.classList.remove('show')
  ui.progressProof.textContent = ''
}

export function renderSuggestedActions(
  ui: ReturnType<typeof getUI>,
  actions: Array<{ label: string; text: string }>,
  personaName?: string
) {
  if (!ui.suggestionRow) return

  if (!actions.length) {
    ui.suggestionRow.innerHTML = ''
    ui.suggestionRow.classList.remove('show')
    return
  }

  const headerLabel = personaName
    ? `「${escapeHtml(personaName)}」建议下一步`
    : '建议下一步'

  ui.suggestionRow.innerHTML =
    `<div class="suggestion-header">${headerLabel}</div>` +
    actions.map((action, index) => `
      <button
        class="suggestion-chip${index === 0 ? ' primary' : ''}"
        data-index="${index}"
        data-text="${escapeHtmlAttr(action.text)}"
        type="button"
      >
        ${escapeHtml(action.label)}
      </button>
    `).join('')

  ui.suggestionRow.classList.add('show')
}

export function flashContextField(el: HTMLElement | null) {
  if (!el) return
  el.classList.remove('context-flash')
  void (el as HTMLElement).offsetWidth
  el.classList.add('context-flash')
}

export function announceStage(stage: string) {
  const el = document.getElementById('stageAnnounce')
  if (!el) return
  el.textContent = `— ${stage} —`
  el.classList.add('show')
  window.setTimeout(() => el.classList.remove('show'), 2000)
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeHtmlAttr(text: string) {
  return escapeHtml(text)
}
