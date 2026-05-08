import { PERSONAS } from './personas'
import { adminFetch } from './adminAuth'

type Zone = {
  id: string
  name: string
  intro?: string
  summary?: string
  historical_context?: string
  next_recommendation?: string
  key_points?: string[]
  location?: {
    floor?: string
    area?: string
    description?: string
  }
  exhibits?: Exhibit[]
}

type Exhibit = {
  id: string
  name: string
  era?: string
  material?: string
  description?: string
  summary?: string
  historical_context?: string
  story?: string
  observation?: string
  children_prompt?: string
  next_recommendation?: string
  aliases?: string[]
  image?: string
}

type DomainPrior = {
  scene?: string
  zones: Zone[]
}

type PersonaConfig = {
  display_name?: string
  start_guide_text?: string
  self_ref?: string
  user_address?: string
  prompt_prefix?: string
  ui_role?: string
  ui_bio?: string
  ui_avatar?: string
}

type AdminContent = {
  domain_prior: DomainPrior
  personas: Record<string, PersonaConfig>
}

type AdminOptions = {
  onContentSaved?: () => Promise<void> | void
}

type SectionKey = 'zone' | 'exhibit' | 'persona'

const PERSONA_ASSET_MAP = new Map(
  PERSONAS.map(persona => [
    persona.id,
    {
      avatar: persona.avatar,
      role: persona.role,
      videoDir: persona.videoDir,
      bio: persona.bio,
    },
  ])
)

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function toText(value: unknown) {
  return String(value ?? '')
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function splitComma(value: string) {
  return value
    .split(/[，,]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function getZonePreviewSrc(zoneId: string) {
  return zoneId ? `/bgs/${zoneId}.png` : ''
}

export function createAdminPage(root: HTMLElement, options: AdminOptions = {}) {
  let content: AdminContent | null = null
  let selectedZoneId = ''
  let selectedExhibitZoneId = ''
  let selectedExhibitId = ''
  let selectedPersonaId = ''
  let eventsBound = false
  let beforeUnloadBound = false
  const dirtyState: Record<SectionKey, boolean> = {
    zone: false,
    exhibit: false,
    persona: false,
  }
  const savingState: Record<SectionKey, boolean> = {
    zone: false,
    exhibit: false,
    persona: false,
  }
  const draftBaseline: Record<SectionKey, string> = {
    zone: '',
    exhibit: '',
    persona: '',
  }

  function renderShell() {
    root.innerHTML = `
      <div class="admin-shell">
        <div class="admin-toolbar">
          <div class="admin-toolbar-copy">保存后会同步刷新导览配置，适合快速改展区、展品和人物文案。</div>
          <div class="admin-status" id="adminStatus">正在加载配置…</div>
        </div>

        <div class="admin-grid">
          <section class="admin-card">
            <div class="admin-card-head">
              <div>
                <div class="admin-card-title">展区管理</div>
                <div class="admin-card-sub">编辑展区名称、简介、楼层位置与推荐话术</div>
                <div class="admin-inline-status" id="zoneInlineStatus">已保存</div>
              </div>
              <select class="admin-select" id="zoneSelect"></select>
            </div>
            <div class="admin-form" id="zoneForm"></div>
            <div class="admin-actions">
              <button class="admin-btn ghost" id="resetZoneBtn" type="button">恢复当前展区</button>
              <button class="admin-btn primary" id="saveZoneBtn" type="button">保存展区配置</button>
            </div>
          </section>

          <section class="admin-card">
            <div class="admin-card-head admin-card-head-stack">
              <div>
                <div class="admin-card-title">展品管理</div>
                <div class="admin-card-sub">编辑展品讲解文案、别名、儿童提示与下一步推荐</div>
                <div class="admin-inline-status" id="exhibitInlineStatus">已保存</div>
              </div>
              <div class="admin-select-row">
                <select class="admin-select" id="exhibitZoneSelect"></select>
                <select class="admin-select" id="exhibitSelect"></select>
              </div>
            </div>
            <div class="admin-form" id="exhibitForm"></div>
            <div class="admin-actions">
              <button class="admin-btn ghost" id="resetExhibitBtn" type="button">恢复当前展品</button>
              <button class="admin-btn primary" id="saveExhibitBtn" type="button">保存展品配置</button>
            </div>
          </section>

          <section class="admin-card admin-card-full">
            <div class="admin-card-head">
              <div>
                <div class="admin-card-title">人物文案管理</div>
                <div class="admin-card-sub">调整人物显示名、开场按钮文案、称呼与提示词前缀</div>
                <div class="admin-inline-status" id="personaInlineStatus">已保存</div>
              </div>
              <select class="admin-select" id="personaSelect"></select>
            </div>
            <div class="admin-form admin-form-wide" id="personaForm"></div>
            <div class="admin-actions">
              <button class="admin-btn ghost" id="resetPersonaBtn" type="button">恢复当前人物</button>
              <button class="admin-btn primary" id="savePersonaBtn" type="button">保存人物配置</button>
            </div>
          </section>
        </div>
      </div>
    `
  }

  function setStatus(text: string, tone: 'idle' | 'success' | 'error' = 'idle') {
    const el = root.querySelector<HTMLElement>('#adminStatus')
    if (!el) return
    el.textContent = text
    el.dataset.tone = tone
  }

  function getInlineStatusEl(section: SectionKey) {
    return root.querySelector<HTMLElement>(`#${section}InlineStatus`)
  }

  function syncSectionControls(section: SectionKey) {
    const inline = getInlineStatusEl(section)
    const saveBtn = root.querySelector<HTMLButtonElement>(`#save${section[0].toUpperCase()}${section.slice(1)}Btn`)
    const resetBtn = root.querySelector<HTMLButtonElement>(`#reset${section[0].toUpperCase()}${section.slice(1)}Btn`)
    const dirty = dirtyState[section]
    const saving = savingState[section]

    if (inline) {
      inline.dataset.tone = saving ? 'saving' : dirty ? 'dirty' : 'clean'
      inline.textContent = saving ? '保存中…' : dirty ? '有未保存修改' : '已保存'
    }
    if (saveBtn) {
      saveBtn.disabled = saving || !dirty
      saveBtn.textContent = saving ? '保存中…' : `保存${section === 'zone' ? '展区' : section === 'exhibit' ? '展品' : '人物'}配置`
    }
    if (resetBtn) {
      resetBtn.disabled = saving || !dirty
    }
  }

  function syncAllSectionControls() {
    syncSectionControls('zone')
    syncSectionControls('exhibit')
    syncSectionControls('persona')
  }

  function getZones() {
    return content?.domain_prior.zones || []
  }

  function getSelectedZone() {
    return getZones().find(zone => zone.id === selectedZoneId) || getZones()[0] || null
  }

  function getSelectedExhibitZone() {
    return getZones().find(zone => zone.id === selectedExhibitZoneId) || getZones()[0] || null
  }

  function getSelectedExhibit() {
    const zone = getSelectedExhibitZone()
    return zone?.exhibits?.find(exhibit => exhibit.id === selectedExhibitId) || zone?.exhibits?.[0] || null
  }

  function getSelectedPersona() {
    if (!content) return null
    return content.personas[selectedPersonaId] || content.personas[Object.keys(content.personas)[0]] || null
  }

  function renderZoneSelect() {
    const select = root.querySelector<HTMLSelectElement>('#zoneSelect')
    if (!select) return
    const zones = getZones()
    if (!selectedZoneId && zones[0]) selectedZoneId = zones[0].id
    select.innerHTML = zones.map(zone => `
      <option value="${escapeHtml(zone.id)}" ${zone.id === selectedZoneId ? 'selected' : ''}>
        ${escapeHtml(zone.name || zone.id)}
      </option>
    `).join('')
  }

  function renderExhibitSelectors() {
    const zoneSelect = root.querySelector<HTMLSelectElement>('#exhibitZoneSelect')
    const exhibitSelect = root.querySelector<HTMLSelectElement>('#exhibitSelect')
    if (!zoneSelect || !exhibitSelect) return
    const zones = getZones().filter(zone => (zone.exhibits || []).length > 0)
    if (!selectedExhibitZoneId && zones[0]) selectedExhibitZoneId = zones[0].id
    zoneSelect.innerHTML = zones.map(zone => `
      <option value="${escapeHtml(zone.id)}" ${zone.id === selectedExhibitZoneId ? 'selected' : ''}>
        ${escapeHtml(zone.name || zone.id)}
      </option>
    `).join('')

    const zone = getSelectedExhibitZone()
    const exhibits = zone?.exhibits || []
    if (!selectedExhibitId && exhibits[0]) selectedExhibitId = exhibits[0].id
    if (!exhibits.find(exhibit => exhibit.id === selectedExhibitId) && exhibits[0]) {
      selectedExhibitId = exhibits[0].id
    }
    exhibitSelect.innerHTML = exhibits.map(exhibit => `
      <option value="${escapeHtml(exhibit.id)}" ${exhibit.id === selectedExhibitId ? 'selected' : ''}>
        ${escapeHtml(exhibit.name || exhibit.id)}
      </option>
    `).join('')
  }

  function renderPersonaSelect() {
    const select = root.querySelector<HTMLSelectElement>('#personaSelect')
    if (!select || !content) return
    const ids = Object.keys(content.personas)
    if (!selectedPersonaId && ids[0]) selectedPersonaId = ids[0]
    select.innerHTML = ids.map(id => `
      <option value="${escapeHtml(id)}" ${id === selectedPersonaId ? 'selected' : ''}>
        ${escapeHtml(content?.personas[id]?.display_name || id)}
      </option>
    `).join('')
  }

  function renderZoneForm() {
    const form = root.querySelector<HTMLElement>('#zoneForm')
    const zone = getSelectedZone()
    if (!form || !zone) return
    const loc = zone.location || {}
    form.innerHTML = `
      <div class="admin-preview admin-preview-wide">
        <img class="admin-preview-image admin-preview-image-zone" src="${escapeHtml(getZonePreviewSrc(zone.id))}" alt="${escapeHtml(toText(zone.name || zone.id))}" />
        <div class="admin-preview-copy">
          <div class="admin-preview-kicker">当前展区预览</div>
          <div class="admin-preview-title">${escapeHtml(toText(zone.name || zone.id))}</div>
          <div class="admin-preview-meta">${escapeHtml([toText(loc.floor), toText(loc.area)].filter(Boolean).join(' · ') || '未配置楼层与区域')}</div>
        </div>
      </div>
      <label class="admin-field">
        <span>展区名称</span>
        <input class="admin-input" id="zoneNameInput" value="${escapeHtml(toText(zone.name))}" />
      </label>
      <label class="admin-field">
        <span>楼层</span>
        <input class="admin-input" id="zoneFloorInput" value="${escapeHtml(toText(loc.floor))}" />
      </label>
      <label class="admin-field">
        <span>区域</span>
        <input class="admin-input" id="zoneAreaInput" value="${escapeHtml(toText(loc.area))}" />
      </label>
      <label class="admin-field admin-field-wide">
        <span>位置描述</span>
        <input class="admin-input" id="zoneLocationDescriptionInput" value="${escapeHtml(toText(loc.description))}" />
      </label>
      <label class="admin-field admin-field-wide">
        <span>展区简介</span>
        <textarea class="admin-textarea" id="zoneIntroInput">${escapeHtml(toText(zone.intro))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>展区摘要</span>
        <textarea class="admin-textarea" id="zoneSummaryInput">${escapeHtml(toText(zone.summary))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>历史背景</span>
        <textarea class="admin-textarea" id="zoneHistoricalInput">${escapeHtml(toText(zone.historical_context))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>导览重点（每行一条）</span>
        <textarea class="admin-textarea" id="zoneKeyPointsInput">${escapeHtml((zone.key_points || []).join('\n'))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>下一步推荐文案</span>
        <textarea class="admin-textarea" id="zoneNextRecommendationInput">${escapeHtml(toText(zone.next_recommendation))}</textarea>
      </label>
    `
    draftBaseline.zone = getZoneSnapshot(zone)
    dirtyState.zone = false
    syncSectionControls('zone')
  }

  function renderExhibitForm() {
    const form = root.querySelector<HTMLElement>('#exhibitForm')
    const exhibit = getSelectedExhibit()
    if (!form) return
    if (!exhibit) {
      form.innerHTML = `<div class="admin-empty">当前展区没有展品可编辑。</div>`
      draftBaseline.exhibit = ''
      dirtyState.exhibit = false
      syncSectionControls('exhibit')
      return
    }
    form.innerHTML = `
      <div class="admin-preview admin-preview-wide">
        <img class="admin-preview-image admin-preview-image-exhibit" src="${escapeHtml(toText(exhibit.image || ''))}" alt="${escapeHtml(toText(exhibit.name || exhibit.id))}" />
        <div class="admin-preview-copy">
          <div class="admin-preview-kicker">当前展品预览</div>
          <div class="admin-preview-title">${escapeHtml(toText(exhibit.name || exhibit.id))}</div>
          <div class="admin-preview-meta">${escapeHtml([toText(exhibit.era), toText(exhibit.material)].filter(Boolean).join(' · ') || '可在下方补充时代与材质')}</div>
        </div>
      </div>
      <label class="admin-field">
        <span>展品名称</span>
        <input class="admin-input" id="exhibitNameInput" value="${escapeHtml(toText(exhibit.name))}" />
      </label>
      <label class="admin-field">
        <span>展品 ID（只读）</span>
        <input class="admin-input" value="${escapeHtml(toText(exhibit.id))}" disabled />
      </label>
      <label class="admin-field">
        <span>时代/时间</span>
        <input class="admin-input" id="exhibitEraInput" value="${escapeHtml(toText(exhibit.era))}" />
      </label>
      <label class="admin-field">
        <span>材质</span>
        <input class="admin-input" id="exhibitMaterialInput" value="${escapeHtml(toText(exhibit.material))}" />
      </label>
      <label class="admin-field admin-field-wide">
        <span>展品简介</span>
        <textarea class="admin-textarea" id="exhibitDescriptionInput">${escapeHtml(toText(exhibit.description))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>讲解摘要</span>
        <textarea class="admin-textarea" id="exhibitSummaryInput">${escapeHtml(toText(exhibit.summary))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>历史背景</span>
        <textarea class="admin-textarea" id="exhibitHistoricalInput">${escapeHtml(toText(exhibit.historical_context))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>讲解故事</span>
        <textarea class="admin-textarea" id="exhibitStoryInput">${escapeHtml(toText(exhibit.story))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>观察提示</span>
        <textarea class="admin-textarea" id="exhibitObservationInput">${escapeHtml(toText(exhibit.observation))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>儿童提示</span>
        <textarea class="admin-textarea" id="exhibitChildrenPromptInput">${escapeHtml(toText(exhibit.children_prompt))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>下一步推荐文案</span>
        <textarea class="admin-textarea" id="exhibitNextRecommendationInput">${escapeHtml(toText(exhibit.next_recommendation))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>别名（逗号分隔）</span>
        <input class="admin-input" id="exhibitAliasesInput" value="${escapeHtml((exhibit.aliases || []).join(', '))}" />
      </label>
      <label class="admin-field admin-field-wide">
        <span>图片路径</span>
        <input class="admin-input" id="exhibitImageInput" value="${escapeHtml(toText(exhibit.image))}" />
      </label>
    `
    draftBaseline.exhibit = getExhibitSnapshot(exhibit)
    dirtyState.exhibit = false
    syncSectionControls('exhibit')
  }

  function renderPersonaForm() {
    const form = root.querySelector<HTMLElement>('#personaForm')
    const persona = getSelectedPersona()
    if (!form || !persona) return
    const personaAsset = PERSONA_ASSET_MAP.get(selectedPersonaId)
    form.innerHTML = `
      <div class="admin-preview admin-preview-wide admin-preview-persona">
        <img class="admin-preview-image admin-preview-image-persona" src="${escapeHtml(toText(persona.ui_avatar || personaAsset?.avatar || ''))}" alt="${escapeHtml(toText(persona.display_name || selectedPersonaId))}" />
        <div class="admin-preview-copy">
          <div class="admin-preview-kicker">当前人物预览</div>
          <div class="admin-preview-title">${escapeHtml(toText(persona.display_name || selectedPersonaId))}</div>
          <div class="admin-preview-meta">${escapeHtml(toText(persona.ui_role || personaAsset?.role || selectedPersonaId))}</div>
          <div class="admin-preview-desc">${escapeHtml(toText(persona.ui_bio || personaAsset?.bio || ''))}</div>
        </div>
      </div>
      <label class="admin-field">
        <span>显示名称</span>
        <input class="admin-input" id="personaDisplayNameInput" value="${escapeHtml(toText(persona.display_name))}" />
      </label>
      <label class="admin-field">
        <span>人物角色标题</span>
        <input class="admin-input" id="personaRoleInput" value="${escapeHtml(toText(persona.ui_role || personaAsset?.role || ''))}" />
      </label>
      <label class="admin-field">
        <span>开始导览按钮文案</span>
        <input class="admin-input" id="personaStartGuideInput" value="${escapeHtml(toText(persona.start_guide_text))}" />
      </label>
      <label class="admin-field">
        <span>自称</span>
        <input class="admin-input" id="personaSelfRefInput" value="${escapeHtml(toText(persona.self_ref))}" />
      </label>
      <label class="admin-field">
        <span>观众称呼</span>
        <input class="admin-input" id="personaUserAddressInput" value="${escapeHtml(toText(persona.user_address))}" />
      </label>
      <label class="admin-field admin-field-wide">
        <span>头像路径</span>
        <input class="admin-input" id="personaAvatarInput" value="${escapeHtml(toText(persona.ui_avatar || personaAsset?.avatar || ''))}" />
      </label>
      <label class="admin-field admin-field-wide">
        <span>人物简介</span>
        <textarea class="admin-textarea" id="personaBioInput">${escapeHtml(toText(persona.ui_bio || personaAsset?.bio || ''))}</textarea>
      </label>
      <label class="admin-field admin-field-wide">
        <span>提示词前缀</span>
        <textarea class="admin-textarea admin-textarea-tall" id="personaPromptPrefixInput">${escapeHtml(toText(persona.prompt_prefix))}</textarea>
      </label>
    `
    draftBaseline.persona = getPersonaSnapshot(persona)
    dirtyState.persona = false
    syncSectionControls('persona')
  }

  function getZoneDraftSnapshotFromForm() {
    return JSON.stringify({
      name: root.querySelector<HTMLInputElement>('#zoneNameInput')?.value.trim() || '',
      floor: root.querySelector<HTMLInputElement>('#zoneFloorInput')?.value.trim() || '',
      area: root.querySelector<HTMLInputElement>('#zoneAreaInput')?.value.trim() || '',
      locationDescription: root.querySelector<HTMLInputElement>('#zoneLocationDescriptionInput')?.value.trim() || '',
      intro: root.querySelector<HTMLTextAreaElement>('#zoneIntroInput')?.value.trim() || '',
      summary: root.querySelector<HTMLTextAreaElement>('#zoneSummaryInput')?.value.trim() || '',
      historicalContext: root.querySelector<HTMLTextAreaElement>('#zoneHistoricalInput')?.value.trim() || '',
      keyPoints: splitLines(root.querySelector<HTMLTextAreaElement>('#zoneKeyPointsInput')?.value || ''),
      nextRecommendation: root.querySelector<HTMLTextAreaElement>('#zoneNextRecommendationInput')?.value.trim() || '',
    })
  }

  function getExhibitDraftSnapshotFromForm() {
    return JSON.stringify({
      name: root.querySelector<HTMLInputElement>('#exhibitNameInput')?.value.trim() || '',
      era: root.querySelector<HTMLInputElement>('#exhibitEraInput')?.value.trim() || '',
      material: root.querySelector<HTMLInputElement>('#exhibitMaterialInput')?.value.trim() || '',
      description: root.querySelector<HTMLTextAreaElement>('#exhibitDescriptionInput')?.value.trim() || '',
      summary: root.querySelector<HTMLTextAreaElement>('#exhibitSummaryInput')?.value.trim() || '',
      historicalContext: root.querySelector<HTMLTextAreaElement>('#exhibitHistoricalInput')?.value.trim() || '',
      story: root.querySelector<HTMLTextAreaElement>('#exhibitStoryInput')?.value.trim() || '',
      observation: root.querySelector<HTMLTextAreaElement>('#exhibitObservationInput')?.value.trim() || '',
      childrenPrompt: root.querySelector<HTMLTextAreaElement>('#exhibitChildrenPromptInput')?.value.trim() || '',
      nextRecommendation: root.querySelector<HTMLTextAreaElement>('#exhibitNextRecommendationInput')?.value.trim() || '',
      aliases: splitComma(root.querySelector<HTMLInputElement>('#exhibitAliasesInput')?.value || ''),
      image: root.querySelector<HTMLInputElement>('#exhibitImageInput')?.value.trim() || '',
    })
  }

  function getPersonaDraftSnapshotFromForm() {
    return JSON.stringify({
      displayName: root.querySelector<HTMLInputElement>('#personaDisplayNameInput')?.value.trim() || '',
      role: root.querySelector<HTMLInputElement>('#personaRoleInput')?.value.trim() || '',
      startGuideText: root.querySelector<HTMLInputElement>('#personaStartGuideInput')?.value.trim() || '',
      selfRef: root.querySelector<HTMLInputElement>('#personaSelfRefInput')?.value.trim() || '',
      userAddress: root.querySelector<HTMLInputElement>('#personaUserAddressInput')?.value.trim() || '',
      avatar: root.querySelector<HTMLInputElement>('#personaAvatarInput')?.value.trim() || '',
      bio: root.querySelector<HTMLTextAreaElement>('#personaBioInput')?.value.trim() || '',
      promptPrefix: root.querySelector<HTMLTextAreaElement>('#personaPromptPrefixInput')?.value.trim() || '',
    })
  }

  function getZoneSnapshot(zone: Zone) {
    return JSON.stringify({
      name: zone.name || '',
      floor: zone.location?.floor || '',
      area: zone.location?.area || '',
      locationDescription: zone.location?.description || '',
      intro: zone.intro || '',
      summary: zone.summary || '',
      historicalContext: zone.historical_context || '',
      keyPoints: zone.key_points || [],
      nextRecommendation: zone.next_recommendation || '',
    })
  }

  function getExhibitSnapshot(exhibit: Exhibit) {
    return JSON.stringify({
      name: exhibit.name || '',
      era: exhibit.era || '',
      material: exhibit.material || '',
      description: exhibit.description || '',
      summary: exhibit.summary || '',
      historicalContext: exhibit.historical_context || '',
      story: exhibit.story || '',
      observation: exhibit.observation || '',
      childrenPrompt: exhibit.children_prompt || '',
      nextRecommendation: exhibit.next_recommendation || '',
      aliases: exhibit.aliases || [],
      image: exhibit.image || '',
    })
  }

  function getPersonaSnapshot(persona: PersonaConfig) {
    return JSON.stringify({
      displayName: persona.display_name || '',
      role: persona.ui_role || '',
      startGuideText: persona.start_guide_text || '',
      selfRef: persona.self_ref || '',
      userAddress: persona.user_address || '',
      avatar: persona.ui_avatar || '',
      bio: persona.ui_bio || '',
      promptPrefix: persona.prompt_prefix || '',
    })
  }

  function refreshDirtyState(section: SectionKey) {
    let current = ''
    if (section === 'zone') current = getZoneDraftSnapshotFromForm()
    if (section === 'exhibit') current = getExhibitDraftSnapshotFromForm()
    if (section === 'persona') current = getPersonaDraftSnapshotFromForm()
    dirtyState[section] = Boolean(draftBaseline[section]) && current !== draftBaseline[section]
    syncSectionControls(section)
  }

  function confirmDiscard(section: SectionKey) {
    if (!dirtyState[section]) return true
    return window.confirm('当前模块有未保存修改，切换后会丢失这些内容。要继续切换吗？')
  }

  function hasUnsavedChanges() {
    return dirtyState.zone || dirtyState.exhibit || dirtyState.persona
  }

  function bindEvents() {
    if (eventsBound) return
    eventsBound = true
    root.querySelector<HTMLSelectElement>('#zoneSelect')?.addEventListener('change', event => {
      const nextValue = (event.currentTarget as HTMLSelectElement).value
      if (!confirmDiscard('zone')) {
        ;(event.currentTarget as HTMLSelectElement).value = selectedZoneId
        return
      }
      selectedZoneId = nextValue
      renderZoneForm()
    })

    root.querySelector<HTMLSelectElement>('#exhibitZoneSelect')?.addEventListener('change', event => {
      const nextValue = (event.currentTarget as HTMLSelectElement).value
      if (!confirmDiscard('exhibit')) {
        ;(event.currentTarget as HTMLSelectElement).value = selectedExhibitZoneId
        return
      }
      selectedExhibitZoneId = nextValue
      selectedExhibitId = ''
      renderExhibitSelectors()
      renderExhibitForm()
    })

    root.querySelector<HTMLSelectElement>('#exhibitSelect')?.addEventListener('change', event => {
      const nextValue = (event.currentTarget as HTMLSelectElement).value
      if (!confirmDiscard('exhibit')) {
        ;(event.currentTarget as HTMLSelectElement).value = selectedExhibitId
        return
      }
      selectedExhibitId = nextValue
      renderExhibitForm()
    })

    root.querySelector<HTMLSelectElement>('#personaSelect')?.addEventListener('change', event => {
      const nextValue = (event.currentTarget as HTMLSelectElement).value
      if (!confirmDiscard('persona')) {
        ;(event.currentTarget as HTMLSelectElement).value = selectedPersonaId
        return
      }
      selectedPersonaId = nextValue
      renderPersonaForm()
    })

    root.querySelector<HTMLButtonElement>('#saveZoneBtn')?.addEventListener('click', saveZone)
    root.querySelector<HTMLButtonElement>('#saveExhibitBtn')?.addEventListener('click', saveExhibit)
    root.querySelector<HTMLButtonElement>('#savePersonaBtn')?.addEventListener('click', savePersona)
    root.querySelector<HTMLButtonElement>('#resetZoneBtn')?.addEventListener('click', () => renderZoneForm())
    root.querySelector<HTMLButtonElement>('#resetExhibitBtn')?.addEventListener('click', () => renderExhibitForm())
    root.querySelector<HTMLButtonElement>('#resetPersonaBtn')?.addEventListener('click', () => renderPersonaForm())

    root.addEventListener('input', event => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('#zoneForm')) refreshDirtyState('zone')
      if (target.closest('#exhibitForm')) refreshDirtyState('exhibit')
      if (target.closest('#personaForm')) refreshDirtyState('persona')
    })

    if (!beforeUnloadBound) {
      window.addEventListener('beforeunload', event => {
        if (!hasUnsavedChanges()) return
        event.preventDefault()
        event.returnValue = ''
      })
      beforeUnloadBound = true
    }
  }

  function applyZoneForm() {
    const zone = getSelectedZone()
    if (!zone) return
    const location = zone.location || {}
    zone.name = root.querySelector<HTMLInputElement>('#zoneNameInput')?.value.trim() || zone.name
    location.floor = root.querySelector<HTMLInputElement>('#zoneFloorInput')?.value.trim() || ''
    location.area = root.querySelector<HTMLInputElement>('#zoneAreaInput')?.value.trim() || ''
    location.description = root.querySelector<HTMLInputElement>('#zoneLocationDescriptionInput')?.value.trim() || ''
    zone.location = location
    zone.intro = root.querySelector<HTMLTextAreaElement>('#zoneIntroInput')?.value.trim() || ''
    zone.summary = root.querySelector<HTMLTextAreaElement>('#zoneSummaryInput')?.value.trim() || ''
    zone.historical_context = root.querySelector<HTMLTextAreaElement>('#zoneHistoricalInput')?.value.trim() || ''
    zone.key_points = splitLines(root.querySelector<HTMLTextAreaElement>('#zoneKeyPointsInput')?.value || '')
    zone.next_recommendation = root.querySelector<HTMLTextAreaElement>('#zoneNextRecommendationInput')?.value.trim() || ''
  }

  function applyExhibitForm() {
    const exhibit = getSelectedExhibit()
    if (!exhibit) return
    exhibit.name = root.querySelector<HTMLInputElement>('#exhibitNameInput')?.value.trim() || exhibit.name
    exhibit.era = root.querySelector<HTMLInputElement>('#exhibitEraInput')?.value.trim() || ''
    exhibit.material = root.querySelector<HTMLInputElement>('#exhibitMaterialInput')?.value.trim() || ''
    exhibit.description = root.querySelector<HTMLTextAreaElement>('#exhibitDescriptionInput')?.value.trim() || ''
    exhibit.summary = root.querySelector<HTMLTextAreaElement>('#exhibitSummaryInput')?.value.trim() || ''
    exhibit.historical_context = root.querySelector<HTMLTextAreaElement>('#exhibitHistoricalInput')?.value.trim() || ''
    exhibit.story = root.querySelector<HTMLTextAreaElement>('#exhibitStoryInput')?.value.trim() || ''
    exhibit.observation = root.querySelector<HTMLTextAreaElement>('#exhibitObservationInput')?.value.trim() || ''
    exhibit.children_prompt = root.querySelector<HTMLTextAreaElement>('#exhibitChildrenPromptInput')?.value.trim() || ''
    exhibit.next_recommendation = root.querySelector<HTMLTextAreaElement>('#exhibitNextRecommendationInput')?.value.trim() || ''
    exhibit.aliases = splitComma(root.querySelector<HTMLInputElement>('#exhibitAliasesInput')?.value || '')
    exhibit.image = root.querySelector<HTMLInputElement>('#exhibitImageInput')?.value.trim() || ''
  }

  function applyPersonaForm() {
    const persona = getSelectedPersona()
    if (!persona) return
    persona.display_name = root.querySelector<HTMLInputElement>('#personaDisplayNameInput')?.value.trim() || ''
    persona.ui_role = root.querySelector<HTMLInputElement>('#personaRoleInput')?.value.trim() || ''
    persona.start_guide_text = root.querySelector<HTMLInputElement>('#personaStartGuideInput')?.value.trim() || ''
    persona.self_ref = root.querySelector<HTMLInputElement>('#personaSelfRefInput')?.value.trim() || ''
    persona.user_address = root.querySelector<HTMLInputElement>('#personaUserAddressInput')?.value.trim() || ''
    persona.ui_avatar = root.querySelector<HTMLInputElement>('#personaAvatarInput')?.value.trim() || ''
    persona.ui_bio = root.querySelector<HTMLTextAreaElement>('#personaBioInput')?.value.trim() || ''
    persona.prompt_prefix = root.querySelector<HTMLTextAreaElement>('#personaPromptPrefixInput')?.value.trim() || ''
  }

  async function fetchContent() {
    const res = await adminFetch('/api/admin/content')
    if (!res.ok) {
      throw new Error(`admin content failed: ${res.status}`)
    }
    content = await res.json() as AdminContent
  }

  async function refreshContentAfterSave() {
    await fetchContent()
    renderZoneSelect()
    renderExhibitSelectors()
    renderPersonaSelect()
    renderZoneForm()
    renderExhibitForm()
    renderPersonaForm()
    syncAllSectionControls()
  }

  async function saveZone() {
    if (!content) return
    applyZoneForm()
    savingState.zone = true
    syncSectionControls('zone')
    setStatus('正在保存展区配置…')
    try {
      const res = await adminFetch('/api/admin/domain_prior', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: content.domain_prior }),
      })
      if (!res.ok) {
        setStatus('展区配置保存失败，请稍后重试。', 'error')
        return
      }
      renderZoneSelect()
      renderExhibitSelectors()
      await options.onContentSaved?.()
      await refreshContentAfterSave()
      draftBaseline.zone = getZoneSnapshot(getSelectedZone()!)
      dirtyState.zone = false
      setStatus('展区配置已保存，并已刷新导览内容。', 'success')
    } catch {
      setStatus('展区配置保存失败，请稍后重试。', 'error')
    } finally {
      savingState.zone = false
      syncSectionControls('zone')
    }
  }

  async function saveExhibit() {
    if (!content) return
    applyExhibitForm()
    savingState.exhibit = true
    syncSectionControls('exhibit')
    setStatus('正在保存展品配置…')
    try {
      const res = await adminFetch('/api/admin/domain_prior', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: content.domain_prior }),
      })
      if (!res.ok) {
        setStatus('展品配置保存失败，请稍后重试。', 'error')
        return
      }
      renderExhibitSelectors()
      await options.onContentSaved?.()
      await refreshContentAfterSave()
      draftBaseline.exhibit = getExhibitSnapshot(getSelectedExhibit()!)
      dirtyState.exhibit = false
      setStatus('展品配置已保存，并已刷新导览内容。', 'success')
    } catch {
      setStatus('展品配置保存失败，请稍后重试。', 'error')
    } finally {
      savingState.exhibit = false
      syncSectionControls('exhibit')
    }
  }

  async function savePersona() {
    if (!content) return
    applyPersonaForm()
    savingState.persona = true
    syncSectionControls('persona')
    setStatus('正在保存人物配置…')
    try {
      const res = await adminFetch('/api/admin/personas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: content.personas }),
      })
      if (!res.ok) {
        setStatus('人物配置保存失败，请稍后重试。', 'error')
        return
      }
      renderPersonaSelect()
      await options.onContentSaved?.()
      await refreshContentAfterSave()
      draftBaseline.persona = getPersonaSnapshot(getSelectedPersona()!)
      dirtyState.persona = false
      setStatus('人物配置已保存，并已刷新导览内容。', 'success')
    } catch {
      setStatus('人物配置保存失败，请稍后重试。', 'error')
    } finally {
      savingState.persona = false
      syncSectionControls('persona')
    }
  }

  async function load() {
    renderShell()
    try {
      await fetchContent()
      renderZoneSelect()
      renderExhibitSelectors()
      renderPersonaSelect()
      renderZoneForm()
      renderExhibitForm()
      renderPersonaForm()
      bindEvents()
      syncAllSectionControls()
      setStatus('配置已加载，可以直接编辑并保存。')
    } catch {
      setStatus('后台配置加载失败，请确认后端服务已启动。', 'error')
    }
  }

  load()
}
