import './styles/main.css'
import * as THREE from 'three'
import { ProfileStore, QUESTS, addXp, xpForLevel, type BodyType, type Expression, type HairStyle, type OutfitId, type Personality, type ProfileData, type WeatherId, type WorldId } from './engine/profile'

const root = document.querySelector<HTMLDivElement>('#ui')!
const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const store = new ProfileStore()
let profile = store.data
let activeTab = 'lab'
let running = false
let faceTexture: THREE.Texture | undefined
let portraitData = ''
let cameraYaw = 0.2
let cameraPitch = 0.22
let dashUntil = 0
let lastFrame = performance.now()
let toastTimer = 0
const keys = new Set<string>()
const touch = { x: 0, y: 0 }
const pointer = { active: false, id: -1, x: 0, y: 0 }
const colors = { ink: 0x080916, pink: 0xff426c, violet: 0x7d5cff, cream: 0xfff7f1, skin: 0xe4b0a0 }

const WORLD_META: Record<WorldId, { name: string; subtitle: string; sky: number; ground: number; fog: number; accent: number; defaultWeather: WeatherId }> = {
  'blood-moon': { name: 'Blood Moon Garden', subtitle: 'A walled garden beneath a patient red moon.', sky: 0x090816, ground: 0x151026, fog: 0x0d0a1e, accent: 0xff426c, defaultWeather: 'clear' },
  'ashen-conservatory': { name: 'Ashen Conservatory', subtitle: 'Broken glass, silver rain, and plants that remember.', sky: 0x10121a, ground: 0x142126, fog: 0x111d25, accent: 0x72e5d4, defaultWeather: 'rain' },
  'velvet-ruins': { name: 'Velvet Ruins', subtitle: 'A theatre-city where the curtains never fall.', sky: 0x160d1c, ground: 0x25132c, fog: 0x1c0f25, accent: 0xc18cff, defaultWeather: 'embers' },
}
const OUTFITS: Record<OutfitId, { label: string; color: string; accent: string; description: string }> = {
  'crimson-jester': { label: 'Crimson Jester', color: '#35152a', accent: '#ff426c', description: 'Burgundy panels, black leather, and a playful silhouette.' },
  'rift-warden': { label: 'Rift Warden', color: '#16334a', accent: '#63d8ff', description: 'A practical coat threaded with cold blue signal light.' },
  'moon-priestess': { label: 'Moon Priestess', color: '#33245b', accent: '#d2b8ff', description: 'Layered midnight fabric for quiet expeditions.' },
  'velvet-rogue': { label: 'Velvet Rogue', color: '#252b25', accent: '#d8c37a', description: 'A tailored forest-black travel set with brass details.' },
}
const HAIRS: Record<HairStyle, string> = { raven: 'Raven Cascade', 'twin-tails': 'Twin Comets', 'silver-bob': 'Silver Bob', crown: 'Crown of Thorns' }
const BODIES: Record<BodyType, string> = { slender: 'Slender', athletic: 'Athletic', regal: 'Regal', spectral: 'Spectral' }
const EXPRESSIONS: Record<Expression, string> = { calm: 'Calm', sly: 'Sly', fierce: 'Fierce' }
const PERSONALITIES: Record<Personality, string> = { poetic: 'Poetic', playful: 'Playful', stoic: 'Stoic' }

root.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <button class="brand-lockup" data-action="tab" data-tab="lab" aria-label="Open character lab"><span class="brand-gem">✦</span><span><span class="brand">MORPH LAB</span><span class="eyebrow">LOCAL AVATAR RPG</span></span></button>
      <nav class="main-nav" aria-label="Main navigation">
        <button class="nav-button active" data-action="tab" data-tab="lab">LAB</button><button class="nav-button" data-action="tab" data-tab="world">WORLDS</button><button class="nav-button" data-action="tab" data-tab="wardrobe">WARDROBE</button><button class="nav-button" data-action="tab" data-tab="quests">QUESTS</button><button class="nav-button" data-action="tab" data-tab="settings">SETTINGS</button>
      </nav>
      <div class="top-status"><span class="status-dot"></span><span>LOCAL MODE</span><span class="save-chip" id="save-chip">SAVED</span></div>
    </header>
    <main class="layout">
      <aside class="left-column panel"><div id="screen-content"></div></aside>
      <section class="viewport-panel">
        <div class="viewport-head"><div><div class="panel-kicker">LIVE WORLD / <span id="world-index">01</span></div><h1 id="scene-title">BLOOD MOON GARDEN</h1><p id="scene-subtitle">A walled garden beneath a patient red moon.</p></div><div class="world-actions"><button class="icon-button" data-action="pause" aria-label="Pause exploration">Ⅱ</button><button class="ghost-button" data-action="reset">RESET RUN</button></div></div>
        <div class="viewport-frame"><div class="scanline"></div><div class="crosshair">+</div><div class="mode-pill" id="mode-pill">LAB PREVIEW</div><div class="weather-pill" id="weather-pill">CLEAR NIGHT</div><div class="interaction-prompt" id="interaction-prompt">Explore freely · collect moon shards</div></div>
        <div class="mobile-controls"><div class="joystick" id="joystick" aria-label="Move"><i></i></div><button id="dash-button" class="dash-button" data-action="dash">DASH</button></div>
        <div class="arena-footer"><div class="footer-status"><b id="footer-name">NIGHTSHADE</b><span id="footer-message">is ready to run.</span></div><button class="play-button" data-action="play"><span id="play-label">ENTER WORLD</span><span>▶</span></button></div>
      </section>
      <aside class="right-column panel"><div class="panel-kicker">LIVE DOSSIER</div><div class="portrait-wrap"><div class="portrait-glow"></div><div class="portrait-placeholder" id="portrait-placeholder">✦</div><img id="portrait" alt="Local face reference crop"/></div><div class="profile-name"><span class="online-mark"></span><h2 id="profile-name">NIGHTSHADE</h2></div><p class="profile-archetype" id="profile-archetype">ATHLETIC · CRIMSON JESTER</p><div class="level-row"><div><span class="level-label">LEVEL <b id="level-value">01</b></span><div class="xp-track"><i id="xp-bar"></i></div></div><strong id="gold-value">◆ 80</strong></div><div class="stat-grid"><div><b id="shard-value">00</b><span>SHARDS</span></div><div><b id="world-value">01/03</b><span>WORLDS</span></div><div><b id="collectible-value">00</b><span>RELICS</span></div></div><div class="companion-card"><div class="companion-orb">◈</div><div><span>LOCAL COMPANION</span><b id="companion-name">VESPER</b><small id="companion-line">“The dark is listening.”</small></div><button class="icon-button small" data-action="voice" aria-label="Hear companion voice">♫</button></div><div class="right-tip"><span>◉</span><span><strong>Private by design</strong><br>Reference images stay in memory on this device.</span></div></aside>
    </main>
    <footer class="footer-note"><span>BUILD 0.4 / ANDROID-FIRST LOCAL RPG</span><span id="footer-meta">MATURE GOTHIC THEMES · FULLY CLOTHED</span></footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <div class="mobile-nav"><button data-action="tab" data-tab="lab">✦<span>LAB</span></button><button data-action="tab" data-tab="world">⌂<span>WORLD</span></button><button data-action="tab" data-tab="wardrobe">◈<span>STYLE</span></button><button data-action="tab" data-tab="quests">◇<span>QUESTS</span></button><button data-action="tab" data-tab="settings">⚙<span>MORE</span></button></div>
  </div>`

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !profile.lowPower, powerPreference: 'high-performance' })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.lowPower ? 1 : 1.6))
renderer.shadowMap.enabled = !profile.lowPower
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const worldGroup = new THREE.Group(); scene.add(worldGroup)
const weatherGroup = new THREE.Group(); scene.add(weatherGroup)
const avatarGroup = new THREE.Group(); scene.add(avatarGroup)
const companionGroup = new THREE.Group(); scene.add(companionGroup)
const moonLight = new THREE.DirectionalLight(0xffd4df, 3.4); moonLight.position.set(-4, 9, -5); moonLight.castShadow = true; moonLight.shadow.mapSize.set(profile.lowPower ? 512 : 1024, profile.lowPower ? 512 : 1024); scene.add(moonLight)
const hemiLight = new THREE.HemisphereLight(0x9c8cff, 0x080813, 1.75); scene.add(hemiLight)
const pinkLight = new THREE.PointLight(colors.pink, 24, 15, 2); pinkLight.position.set(-5, 3, -4); scene.add(pinkLight)
const fillLight = new THREE.PointLight(0xff8ca9, 14, 12, 2); fillLight.position.set(2, 4, -5); scene.add(fillLight)
const pickups: THREE.Mesh[] = []
let weatherPoints: THREE.Points | undefined
let ground: THREE.Mesh | undefined
let avatarAura: THREE.Mesh | undefined
let companionName = 'VESPER'
let companionMoods = ['“The dark is listening.”', '“A shard remembers every hand.”', '“Try the conservatory when the rain begins.”']
let companionMoodIndex = 0

function clearGroup(group: THREE.Group): void { while (group.children.length) group.remove(group.children[0]) }
function mat(color: string | number, metalness = 0.1, roughness = 0.6): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, metalness, roughness }) }
function safeText(value: string): string { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char) }
function setText(id: string, value: string): void { const node = document.getElementById(id); if (node) node.textContent = value }
function announce(message: string): void { const node = document.getElementById('toast'); if (!node) return; node.textContent = message; node.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => node.classList.remove('show'), 2800) }
function saveProfile(): void { store.data = profile; store.save(); const chip = document.getElementById('save-chip'); if (chip) { chip.textContent = 'SAVED'; chip.classList.add('pulse'); window.setTimeout(() => chip.classList.remove('pulse'), 600) } }
function updateProfile(patch: Partial<ProfileData>, message?: string): void { profile = { ...profile, ...patch }; store.data = profile; store.save(); updateHUD(); if (message) announce(message) }

function defaultFaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!
  const gradient = ctx.createRadialGradient(128, 108, 10, 128, 128, 150); gradient.addColorStop(0, '#f2c6bd'); gradient.addColorStop(1, '#8b4d66'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = '#2a0d24'; ctx.beginPath(); ctx.ellipse(82, 112, 15, 6, -0.1, 0, Math.PI * 2); ctx.ellipse(174, 112, 15, 6, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#160b17'; ctx.beginPath(); ctx.ellipse(82, 112, 5, 5, 0, 0, Math.PI * 2); ctx.ellipse(174, 112, 5, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#6b203b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(128, 160, 26, 0.15, Math.PI - 0.15); ctx.stroke(); return new THREE.CanvasTexture(c)
}
const syntheticFace = defaultFaceTexture()

function buildAvatar(): void {
  clearGroup(avatarGroup)
  const outfit = OUTFITS[profile.outfit]
  const outfitMat = mat(outfit.color, 0.32, 0.4)
  const accentMat = mat(outfit.accent, 0.55, 0.22)
  const skinMat = mat(colors.skin, 0, 0.62)
  const bodyScale = profile.body === 'slender' ? [0.9, 1, 0.86] : profile.body === 'regal' ? [1.08, 1.06, 0.94] : profile.body === 'spectral' ? [0.96, 1.15, 0.9] : [1, 1, 1]
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.54, 0.72, 8, 16), outfitMat); torso.position.y = 1.25; torso.scale.set(bodyScale[0], bodyScale[1], bodyScale[2]); avatarGroup.add(torso)
  const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.82 * bodyScale[0], 0.92 * bodyScale[1], 8, 1, true), outfitMat); mantle.position.y = 1.12; mantle.rotation.x = Math.PI; avatarGroup.add(mantle)
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.72, 6, 12), mat(0x111321, 0.24, 0.37)); leg.position.set(-0.22 * bodyScale[0], 0.53, 0); leg.scale.x = bodyScale[0]; avatarGroup.add(leg); const leg2 = leg.clone(); leg2.position.x *= -1; avatarGroup.add(leg2)
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.6), mat(0x090a12, 0.58, 0.24)); boot.position.set(-0.22, 0.14, -0.08); avatarGroup.add(boot); const boot2 = boot.clone(); boot2.position.x *= -1; avatarGroup.add(boot2)
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.64, 6, 10), outfitMat); arm.position.set(-0.68 * bodyScale[0], 1.34, 0); arm.rotation.z = -0.12; avatarGroup.add(arm); const arm2 = arm.clone(); arm2.position.x *= -1; arm2.rotation.z = 0.12; avatarGroup.add(arm2)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.47, 24, 18), skinMat); head.position.y = 2.31; head.scale.set(0.92 * bodyScale[0], 1.06 * bodyScale[1], 0.86); avatarGroup.add(head)
  const hairMat = mat(profile.hair === 'silver-bob' ? 0xc7b8ff : profile.hair === 'twin-tails' ? 0xc23a5b : profile.hair === 'crown' ? 0x422044 : 0x210e1b, 0.05, 0.3)
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.54, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.72), hairMat); hair.position.set(0, 2.45, 0.02); hair.scale.set(1.03, 1.12, 0.98); avatarGroup.add(hair)
  if (profile.hair === 'twin-tails') { for (const x of [-0.46, 0.46]) { const tail = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), hairMat); tail.position.set(x, 2.48, 0.02); tail.scale.set(0.72, 1.55, 0.72); avatarGroup.add(tail) } }
  if (profile.hair === 'crown') { for (let i = 0; i < 7; i += 1) { const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.38, 6), hairMat); const a = (i / 7) * Math.PI * 2; thorn.position.set(Math.cos(a) * 0.34, 2.8, Math.sin(a) * 0.16); thorn.rotation.z = Math.cos(a) * 0.5; thorn.rotation.x = Math.sin(a) * 0.5; avatarGroup.add(thorn) } }
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), new THREE.MeshBasicMaterial({ map: faceTexture ?? syntheticFace, transparent: true, depthWrite: false })); face.position.set(0, 2.32, 0.58); face.scale.set(1, 1.2, 1); avatarGroup.add(face)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.055, 8, 32), accentMat); collar.rotation.x = Math.PI / 2; collar.position.set(0, 1.84, -0.04); avatarGroup.add(collar)
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), accentMat); emblem.position.set(0, 1.42, 0.54); avatarGroup.add(emblem)
  avatarAura = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.018, 8, 64), new THREE.MeshBasicMaterial({ color: outfit.accent, transparent: true, opacity: 0.78 })); avatarAura.rotation.x = Math.PI / 2; avatarAura.position.y = 0.04; avatarGroup.add(avatarAura)
  avatarGroup.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true } })
}

function buildWorld(): void {
  const meta = WORLD_META[profile.currentWorld]
  clearGroup(worldGroup); clearGroup(companionGroup); pickups.length = 0
  scene.background = new THREE.Color(meta.sky); scene.fog = new THREE.FogExp2(meta.fog, profile.lowPower ? 0.045 : 0.032)
  ground = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: meta.ground, roughness: 0.84, metalness: 0.08 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; worldGroup.add(ground)
  const grid = new THREE.GridHelper(19, 19, meta.accent, 0x24183b); grid.position.y = 0.014; (grid.material as THREE.Material).opacity = 0.42; (grid.material as THREE.Material).transparent = true; worldGroup.add(grid)
  const ring = new THREE.Mesh(new THREE.RingGeometry(8.8, 8.88, 96), new THREE.MeshBasicMaterial({ color: meta.accent, transparent: true, opacity: 0.74, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; worldGroup.add(ring)
  for (const [x, z] of [[-8, -6], [8, 6], [-7, 6], [7, -6]]) { const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 2.2, 8), mat(meta.accent, 0.35, 0.42)); pillar.position.set(x, 1.1, z); pillar.castShadow = true; worldGroup.add(pillar) }
  const positions = profile.currentWorld === 'ashen-conservatory' ? [[-5, -4], [-1, -5], [4, -4], [6, -1], [-6, 1], [-2, 3], [2, 4], [5, 5], [-6, 5], [0, 0]] : profile.currentWorld === 'velvet-ruins' ? [[-5, -4], [-2, -5], [3, -4], [6, -2], [-5, 0], [-2, 3], [2, 4], [5, 4], [-6, 5], [0, -1]] : [[-4, -3], [-1, -5], [3, -4], [5, -1], [-5, 1], [-2, 3], [2, 4], [5, 4], [-6, 5], [0, 0]]
  for (const [x, z] of positions) { const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), new THREE.MeshStandardMaterial({ color: colors.cream, emissive: meta.accent, emissiveIntensity: 3.4, metalness: 0.26, roughness: 0.2 })); shard.position.set(x, 0.55, z); shard.castShadow = true; worldGroup.add(shard); pickups.push(shard) }
  for (const [x, z] of [[-3, 5], [4, 2]]) { const relic = new THREE.Mesh(new THREE.TorusKnotGeometry(0.25, 0.055, 32, 8), new THREE.MeshStandardMaterial({ color: meta.accent, emissive: meta.accent, emissiveIntensity: 2.4, metalness: 0.7, roughness: 0.2 })); relic.position.set(x, 0.75, z); relic.userData.relic = `${profile.currentWorld}:${x}:${z}`; worldGroup.add(relic) }
  companionName = profile.currentWorld === 'velvet-ruins' ? 'ORRERY' : profile.currentWorld === 'ashen-conservatory' ? 'MOSS' : 'VESPER'
  const companionMat = new THREE.MeshStandardMaterial({ color: meta.accent, emissive: meta.accent, emissiveIntensity: 3, transparent: true, opacity: 0.86 })
  for (const [x, z] of [[-2.6, -1.2], [2.8, 2.4]]) { const wisp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), companionMat); wisp.position.set(x, 1.25, z); wisp.userData.base = new THREE.Vector3(x, 1.25, z); companionGroup.add(wisp) }
  buildWeather(); updateHUD();
}

function buildWeather(): void {
  clearGroup(weatherGroup); weatherPoints = undefined
  if (profile.weather === 'clear') return
  const count = profile.lowPower ? 100 : 220; const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) { positions[i * 3] = (Math.random() - 0.5) * 24; positions[i * 3 + 1] = Math.random() * 7; positions[i * 3 + 2] = (Math.random() - 0.5) * 24 }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const meta = WORLD_META[profile.currentWorld]; const color = profile.weather === 'rain' ? 0x9fd6ff : profile.weather === 'embers' ? 0xff704d : 0xd6d0ff
  const material = new THREE.PointsMaterial({ color, size: profile.weather === 'rain' ? 0.055 : 0.12, transparent: true, opacity: profile.weather === 'mist' ? 0.18 : 0.72, blending: THREE.AdditiveBlending })
  weatherPoints = new THREE.Points(geometry, material); weatherPoints.userData.color = meta.accent; weatherGroup.add(weatherPoints)
}

function updateLighting(now: number): void {
  const phase = (profile.dayPhase + now * 0.000012) % 1
  const night = 0.52 + Math.sin(phase * Math.PI * 2) * 0.26
  moonLight.intensity = 2.3 + night * 1.8; hemiLight.intensity = 1.2 + night; pinkLight.intensity = 17 + night * 10; fillLight.intensity = 8 + night * 8
  if (weatherPoints) weatherPoints.rotation.y += 0.00018
  avatarAura?.rotation && (avatarAura.rotation.z += profile.reducedMotion ? 0.001 : 0.008)
}

function updateWorldUI(): void {
  const meta = WORLD_META[profile.currentWorld]; const worldNumber = ['blood-moon', 'ashen-conservatory', 'velvet-ruins'].indexOf(profile.currentWorld) + 1
  setText('world-index', String(worldNumber).padStart(2, '0')); setText('scene-title', meta.name.toUpperCase()); setText('scene-subtitle', meta.subtitle); setText('weather-pill', `${profile.weather.toUpperCase()} · ${profile.dayPhase < 0.28 || profile.dayPhase > 0.78 ? 'NIGHT' : 'DAWN'}`)
  setText('companion-name', companionName); setText('companion-line', companionMoods[companionMoodIndex % companionMoods.length]); setText('world-value', `${profile.visitedWorlds.length}/03`)
}

function updateHUD(): void {
  setText('profile-name', profile.name); setText('footer-name', profile.name); setText('profile-archetype', `${BODIES[profile.body].toUpperCase()} · ${OUTFITS[profile.outfit].label.toUpperCase()}`); setText('level-value', String(profile.level).padStart(2, '0')); setText('gold-value', `◆ ${profile.gold}`); setText('shard-value', String(profile.shards).padStart(2, '0')); setText('collectible-value', String(profile.collectibles.length).padStart(2, '0'))
  const progress = Math.min(1, profile.xp / xpForLevel(profile.level)); const bar = document.getElementById('xp-bar') as HTMLElement | null; if (bar) bar.style.width = `${progress * 100}%`
  setText('footer-meta', profile.adultAtmosphere ? 'MATURE GOTHIC THEMES · FULLY CLOTHED' : 'ALL-AGES GOTHIC THEMES · FULLY CLOTHED'); updateWorldUI()
}

function questProgress(id: string, progress: number): void { const quest = profile.quests.find(q => q.id === id); const target = QUESTS.find(q => q.id === id)?.target ?? 1; if (!quest) return; quest.progress = Math.min(target, Math.max(quest.progress, Math.floor(progress))); quest.complete = quest.progress >= target }
function checkMilestones(): void {
  questProgress('first-shards', profile.shards); questProgress('world-walker', profile.visitedWorlds.length); questProgress('wardrobe', profile.collectibles.filter(id => id.startsWith('outfit:')).length)
  if (profile.level >= 2 && !profile.achievements.includes('awakened')) profile.achievements.push('awakened')
  if (profile.shards >= 20 && !profile.achievements.includes('shard-seeker')) profile.achievements.push('shard-seeker')
  if (profile.visitedWorlds.length === 3 && !profile.achievements.includes('threshold-walker')) profile.achievements.push('threshold-walker')
  for (const quest of profile.quests) if (quest.complete && !quest.claimed) { const meta = QUESTS.find(q => q.id === quest.id)!; quest.claimed = true; profile.gold += meta.reward; announce(`Quest complete: ${meta.title} · +${meta.reward} gold`) }
}
function collectShard(shard: THREE.Mesh): void { shard.visible = false; profile.shards += 1; profile.gold += 4; const level = addXp(profile, 24); if (level.leveled) { announce(`Level ${profile.level} reached · new wardrobe energy unlocked`); playTone(660, 0.16) } else { playTone(440 + (profile.shards % 4) * 55, 0.1) } checkMilestones(); saveProfile(); updateHUD() }
function collectRelic(object: THREE.Object3D): void { const id = object.userData.relic as string; if (profile.collectibles.includes(id)) return; profile.collectibles.push(id); profile.gold += 35; addXp(profile, 70); announce('Relic recovered · +35 gold'); playTone(780, 0.18); checkMilestones(); saveProfile(); updateHUD() }

function playTone(frequency: number, duration: number): void {
  if (!profile.soundOn) return
  try { const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AudioContextClass) return; const ctx = new AudioContextClass(); const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); const pan = ctx.createStereoPanner(); oscillator.frequency.value = frequency; oscillator.type = 'sine'; pan.pan.value = Math.max(-1, Math.min(1, avatarGroup.position.x / 8)); gain.gain.setValueAtTime(0.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration); oscillator.connect(gain).connect(pan).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + duration + 0.03); window.setTimeout(() => void ctx.close(), 500) } catch { /* Audio is an enhancement, not a dependency. */ }
}
function speakCompanion(): void { if (!('speechSynthesis' in window)) { announce('Voice synthesis is unavailable on this device.'); return } const utterance = new SpeechSynthesisUtterance(companionMoods[companionMoodIndex % companionMoods.length].replace(/[“”]/g, '')); utterance.rate = profile.personality === 'playful' ? 1.08 : 0.84; utterance.pitch = profile.personality === 'stoic' ? 0.75 : 1.05; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); companionMoodIndex += 1; updateWorldUI() }

function renderLab(): string {
  return `<div class="panel-kicker">01 / CHARACTER LAB</div><h2>Make the <em>impossible</em> playable.</h2><p class="intro">Your photo stays on this device. It becomes a 2D face texture on a procedural avatar, not an AI-made 3D likeness. Customize your character and explore the thresholds.</p><label class="upload-zone" for="image-input"><input id="image-input" type="file" accept="image/*"/><span class="upload-icon">↥</span><span><strong>Use a local face reference</strong><small>2D face texture only; kept in memory on this device.</small></span><b>ADD</b></label><div class="field"><label for="name-input">AVATAR NAME</label><input id="name-input" maxlength="18" value="${safeText(profile.name)}"/></div><div class="field"><label for="personality-input">PERSONALITY</label><select id="personality-input">${Object.entries(PERSONALITIES).map(([id, label]) => `<option value="${id}" ${profile.personality === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="trait-line"><span>BODY</span><b>${BODIES[profile.body]}</b><button class="text-button" data-action="tab" data-tab="wardrobe">EDIT</button></div><div class="trait-line"><span>EXPRESSION</span><b>${EXPRESSIONS[profile.expression]}</b><button class="text-button" data-action="tab" data-tab="wardrobe">EDIT</button></div><button class="primary-button" data-action="morph">MORPH THIS IDEA <span>↗</span></button><div class="privacy-note"><span>◉</span><span><strong>Local-only reference</strong><br>No account, server, or upload required.</span></div>`
}
function renderWorlds(): string {
  return `<div class="panel-kicker">02 / WORLDS</div><h2>Choose a threshold.</h2><p class="intro">Explore without combat. Every arena has its own light, weather, companion, relics, and shard route.</p><div class="world-list">${(Object.keys(WORLD_META) as WorldId[]).map((id, index) => { const meta = WORLD_META[id]; return `<button class="world-card ${profile.currentWorld === id ? 'selected' : ''}" data-action="world" data-world="${id}"><span class="world-index">0${index + 1}</span><span><strong>${meta.name}</strong><small>${meta.subtitle}</small></span><b>↗</b></button>` }).join('')}</div><div class="field"><label for="weather-input">WEATHER</label><select id="weather-input">${(['clear', 'rain', 'embers', 'mist'] as WeatherId[]).map(id => `<option value="${id}" ${profile.weather === id ? 'selected' : ''}>${id[0].toUpperCase() + id.slice(1)}</option>`).join('')}</select></div><button class="secondary-button" data-action="cycle-time">ADVANCE DAY / NIGHT</button>`
}
function renderWardrobe(): string {
  return `<div class="panel-kicker">03 / WARDROBE</div><h2>Dress the legend.</h2><p class="intro">Every look is a playable loadout. The supplied outfit reference informed the Crimson Jester palette: burgundy, black, and brass.</p><div class="mini-label">OUTFITS</div><div class="wardrobe-grid">${(Object.keys(OUTFITS) as OutfitId[]).map(id => `<button class="wardrobe-card ${profile.outfit === id ? 'selected' : ''}" data-action="outfit" data-outfit="${id}"><span class="outfit-swatch" style="--outfit:${OUTFITS[id].color};--accent:${OUTFITS[id].accent}"></span><strong>${OUTFITS[id].label}</strong><small>${OUTFITS[id].description}</small></button>`).join('')}</div><div class="mini-label">BODY / HAIR / EXPRESSION</div><div class="chip-grid">${(Object.keys(BODIES) as BodyType[]).map(id => `<button class="chip ${profile.body === id ? 'selected' : ''}" data-action="body" data-value="${id}">${BODIES[id]}</button>`).join('')}</div><div class="chip-grid">${(Object.keys(HAIRS) as HairStyle[]).map(id => `<button class="chip ${profile.hair === id ? 'selected' : ''}" data-action="hair" data-value="${id}">${HAIRS[id]}</button>`).join('')}</div><div class="chip-grid">${(Object.keys(EXPRESSIONS) as Expression[]).map(id => `<button class="chip ${profile.expression === id ? 'selected' : ''}" data-action="expression" data-value="${id}">${EXPRESSIONS[id]}</button>`).join('')}</div>`
}
function renderQuests(): string {
  return `<div class="panel-kicker">04 / QUESTS & ACHIEVEMENTS</div><h2>Leave a trace.</h2><p class="intro">Progress is saved locally. No account or leaderboard is required.</p><div class="quest-list">${QUESTS.map(meta => { const quest = profile.quests.find(q => q.id === meta.id)!; return `<article class="quest-card ${quest.complete ? 'complete' : ''}"><div><strong>${meta.title}</strong><small>${meta.description}</small></div><b>${quest.progress}/${meta.target}</b><div class="quest-track"><i style="width:${(quest.progress / meta.target) * 100}%"></i></div><span>${quest.claimed ? 'REWARD CLAIMED' : quest.complete ? `+${meta.reward} GOLD READY` : `${meta.reward} GOLD`}</span></article>` }).join('')}</div><div class="mini-label">ACHIEVEMENTS</div><div class="achievement-row">${[['awakened', 'AWAKENED'], ['shard-seeker', 'SHARD SEEKER'], ['threshold-walker', 'THRESHOLD WALKER']].map(([id, label]) => `<span class="achievement ${profile.achievements.includes(id) ? 'unlocked' : ''}">${profile.achievements.includes(id) ? '◆' : '◇'} ${label}</span>`).join('')}</div>`
}
function renderSettings(): string {
  return `<div class="panel-kicker">05 / SETTINGS</div><h2>Your way to play.</h2><p class="intro">Tune the experience for your device, motion comfort, and mature gothic atmosphere.</p><label class="setting-row"><span><strong>Reduced motion</strong><small>Calms camera, aura, and weather movement.</small></span><input type="checkbox" data-setting="reducedMotion" ${profile.reducedMotion ? 'checked' : ''}/></label><label class="setting-row"><span><strong>Low-power rendering</strong><small>Lower pixel ratio and lighter weather for older phones.</small></span><input type="checkbox" data-setting="lowPower" ${profile.lowPower ? 'checked' : ''}/></label><label class="setting-row"><span><strong>Companion audio</strong><small>Local tones and optional device speech synthesis.</small></span><input type="checkbox" data-setting="soundOn" ${profile.soundOn ? 'checked' : ''}/></label><label class="setting-row"><span><strong>Mature atmosphere</strong><small>Fully clothed gothic themes; never explicit.</small></span><input type="checkbox" data-setting="adultAtmosphere" ${profile.adultAtmosphere ? 'checked' : ''}/></label><button class="secondary-button" data-action="save-now">SAVE PROFILE NOW</button><button class="danger-button" data-action="reset-profile">RESET LOCAL PROFILE</button><div class="security-note">Local profile storage contains progression and preferences only. Face references are never written to the save file.</div>`
}
function renderTab(tab = activeTab): void { activeTab = tab; const content = document.getElementById('screen-content'); if (!content) return; content.innerHTML = tab === 'lab' ? renderLab() : tab === 'world' ? renderWorlds() : tab === 'wardrobe' ? renderWardrobe() : tab === 'quests' ? renderQuests() : renderSettings(); document.querySelectorAll<HTMLElement>('[data-action="tab"]').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab)) }

function applyMorph(): void { const name = (document.getElementById('name-input') as HTMLInputElement | null)?.value.trim().toUpperCase(); const personality = (document.getElementById('personality-input') as HTMLSelectElement | null)?.value as Personality | undefined; updateProfile({ name: name || 'NIGHTSHADE', personality: personality ?? profile.personality }, 'Avatar morphed · ready for exploration'); buildAvatar(); updateHUD() }
function handleFace(file: File): void {
  if (file.type && !file.type.startsWith('image/')) { announce('Choose an image file.'); return }
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    try {
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image')
      const c = document.createElement('canvas'); c.width = c.height = 256
      const ctx = c.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      const crop = Math.min(image.naturalWidth, image.naturalHeight * 0.72)
      const sx = (image.naturalWidth - crop) / 2
      const sy = Math.max(0, image.naturalHeight * 0.02)
      ctx.drawImage(image, sx, sy, crop, Math.min(crop, image.naturalHeight - sy), 0, 0, 256, 256)
      const nextPortraitData = c.toDataURL('image/jpeg', 0.84)
      const nextFaceTexture = new THREE.CanvasTexture(c)
      nextFaceTexture.colorSpace = THREE.SRGBColorSpace
      faceTexture?.dispose()
      faceTexture = nextFaceTexture
      portraitData = nextPortraitData
      const portrait = document.getElementById('portrait') as HTMLImageElement | null
      if (portrait) { portrait.src = portraitData; portrait.classList.add('visible') }
      document.getElementById('portrait-placeholder')?.classList.add('hidden')
      buildAvatar()
      announce('Photo mapped as a 2D face texture · held in memory only')
    } catch {
      announce('Could not read that image. Try a JPG or PNG.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  image.onerror = () => { URL.revokeObjectURL(url); announce('Could not read that image. Try a JPG or PNG.') }
  image.src = url
}
function clearFaceReference(): void {
  faceTexture?.dispose()
  faceTexture = undefined
  portraitData = ''
  const portrait = document.getElementById('portrait') as HTMLImageElement | null
  if (portrait) { portrait.removeAttribute('src'); portrait.classList.remove('visible') }
  document.getElementById('portrait-placeholder')?.classList.remove('hidden')
}
function changeWorld(id: WorldId): void { profile.currentWorld = id; if (!profile.visitedWorlds.includes(id)) profile.visitedWorlds.push(id); profile.weather = WORLD_META[id].defaultWeather; checkMilestones(); saveProfile(); buildWorld(); avatarGroup.position.set(0, 0, 0); announce(`Entered ${WORLD_META[id].name}`); renderTab('world') }
function chooseOutfit(id: OutfitId): void { profile.outfit = id; const marker = `outfit:${id}`; if (!profile.collectibles.includes(marker)) profile.collectibles.push(marker); checkMilestones(); saveProfile(); buildAvatar(); updateHUD(); renderTab('wardrobe'); announce(`${OUTFITS[id].label} equipped`) }
function beginPlay(): void { running = true; setText('mode-pill', 'EXPLORATION'); setText('play-label', 'PAUSE WORLD'); setText('footer-message', 'is exploring.'); document.body.classList.add('playing'); profile.seenTutorial = true; saveProfile(); announce('Explore freely · collect shards and relics') }
function pausePlay(): void { running = false; setText('mode-pill', 'PAUSED'); setText('play-label', 'ENTER WORLD'); document.body.classList.remove('playing') }
function resetRun(): void { avatarGroup.position.set(0, 0, 0); pickups.forEach(pickup => { pickup.visible = true }); running = false; setText('mode-pill', 'LAB PREVIEW'); setText('play-label', 'ENTER WORLD'); document.body.classList.remove('playing'); announce('Run reset · your profile was kept safe') }
function cycleTime(): void { profile.dayPhase = (profile.dayPhase + 0.23) % 1; saveProfile(); updateWorldUI(); announce(profile.dayPhase < 0.28 || profile.dayPhase > 0.78 ? 'Night cycle engaged' : 'Dawn cycle engaged') }

root.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (!target) return
  const action = target.dataset.action
  if (action === 'tab') renderTab(target.dataset.tab ?? 'lab')
  else if (action === 'morph') applyMorph()
  else if (action === 'play') running ? pausePlay() : beginPlay()
  else if (action === 'pause') running ? pausePlay() : beginPlay()
  else if (action === 'dash') dashUntil = performance.now() + 230
  else if (action === 'reset') resetRun()
  else if (action === 'voice') speakCompanion()
  else if (action === 'world') changeWorld(target.dataset.world as WorldId)
  else if (action === 'outfit') chooseOutfit(target.dataset.outfit as OutfitId)
  else if (action === 'body') { profile.body = target.dataset.value as BodyType; saveProfile(); buildAvatar(); renderTab('wardrobe'); updateHUD() }
  else if (action === 'hair') { profile.hair = target.dataset.value as HairStyle; saveProfile(); buildAvatar(); renderTab('wardrobe'); updateHUD() }
  else if (action === 'expression') { profile.expression = target.dataset.value as Expression; saveProfile(); buildAvatar(); renderTab('wardrobe'); updateHUD() }
  else if (action === 'cycle-time') cycleTime()
  else if (action === 'save-now') { saveProfile(); announce('Profile saved locally') }
  else if (action === 'reset-profile') { if (window.confirm('Reset local progression and wardrobe choices?')) { store.reset(); profile = store.data; clearFaceReference(); buildAvatar(); buildWorld(); renderTab('lab'); updateHUD(); announce('Local profile reset') } }
})
root.addEventListener('change', event => {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  if (target.id === 'image-input' && target instanceof HTMLInputElement) { const file = target.files?.[0]; target.value = ''; if (file) handleFace(file) }
  if (target.id === 'weather-input') { profile.weather = target.value as WeatherId; buildWeather(); saveProfile(); updateWorldUI(); announce(`${target.value[0].toUpperCase()}${target.value.slice(1)} weather engaged`) }
  if (target.id === 'personality-input') { profile.personality = target.value as Personality; saveProfile(); announce(`${PERSONALITIES[profile.personality]} personality selected`) }
  if (target instanceof HTMLInputElement && target.dataset.setting) { const key = target.dataset.setting as keyof ProfileData; const checked = target.checked; (profile as unknown as Record<string, unknown>)[key] = checked; saveProfile(); if (key === 'lowPower') { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, checked ? 1 : 1.6)); renderer.shadowMap.enabled = !checked; buildWeather() }; if (key === 'adultAtmosphere') setText('footer-meta', checked ? 'MATURE GOTHIC THEMES · FULLY CLOTHED' : 'ALL-AGES GOTHIC THEMES · FULLY CLOTHED'); if (key === 'reducedMotion') document.body.classList.toggle('reduced-motion', checked); announce('Setting saved locally') }
})
root.addEventListener('input', event => { const target = event.target as HTMLInputElement; if (target.id === 'name-input') { profile.name = target.value.trim().toUpperCase().slice(0, 18) || 'NIGHTSHADE'; setText('profile-name', profile.name); setText('footer-name', profile.name) } })

window.addEventListener('keydown', event => { if (event.code === 'Escape') { pausePlay(); return } if (!['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) { keys.add(event.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault() } })
window.addEventListener('keyup', event => keys.delete(event.code)); window.addEventListener('blur', () => keys.clear())
const joystick = document.getElementById('joystick')!
joystick.addEventListener('pointerdown', event => { joystick.setPointerCapture(event.pointerId); const move = (pointerEvent: PointerEvent) => { const rect = joystick.getBoundingClientRect(); const dx = pointerEvent.clientX - (rect.left + rect.width / 2); const dy = pointerEvent.clientY - (rect.top + rect.height / 2); const length = Math.max(1, Math.hypot(dx, dy)); touch.x = Math.max(-1, Math.min(1, dx / 36)); touch.y = Math.max(-1, Math.min(1, dy / 36)); const knob = joystick.querySelector<HTMLElement>('i'); if (knob) knob.style.transform = `translate(${Math.min(36, length) * dx / length}px, ${Math.min(36, length) * dy / length}px)` }; const end = () => { touch.x = 0; touch.y = 0; const knob = joystick.querySelector<HTMLElement>('i'); if (knob) knob.style.transform = ''; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }; move(event); window.addEventListener('pointermove', move); window.addEventListener('pointerup', end) })
canvas.addEventListener('pointerdown', event => { if (!running || (event.pointerType === 'mouse' && event.button !== 0)) return; pointer.active = true; pointer.id = event.pointerId; pointer.x = event.clientX; pointer.y = event.clientY; canvas.setPointerCapture(event.pointerId) })
canvas.addEventListener('pointermove', event => { if (!pointer.active || event.pointerId !== pointer.id) return; cameraYaw -= (event.clientX - pointer.x) * 0.009; cameraPitch = THREE.MathUtils.clamp(cameraPitch - (event.clientY - pointer.y) * 0.004, -0.1, 0.65); pointer.x = event.clientX; pointer.y = event.clientY })
canvas.addEventListener('pointerup', event => { if (event.pointerId === pointer.id) pointer.active = false })
canvas.addEventListener('pointercancel', event => { if (event.pointerId === pointer.id) pointer.active = false })
window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix() })

function updateMovement(dt: number, now: number): void {
  const moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touch.x
  const moveZ = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + touch.y
  const length = Math.hypot(moveX, moveZ); if (!running || !length) return
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || now < dashUntil ? 2.1 : 1
  const speed = 3.9 * boost; avatarGroup.position.x = THREE.MathUtils.clamp(avatarGroup.position.x + moveX / length * speed * dt, -8.6, 8.6); avatarGroup.position.z = THREE.MathUtils.clamp(avatarGroup.position.z + moveZ / length * speed * dt, -8.6, 8.6)
  const targetRotation = Math.atan2(moveX, moveZ); avatarGroup.rotation.y = THREE.MathUtils.lerp(avatarGroup.rotation.y, targetRotation, 1 - Math.pow(0.0001, dt)); if (!profile.reducedMotion) avatarGroup.position.y = Math.sin(now * 0.008) * 0.035
}
function updatePickups(now: number): void { pickups.forEach((pickup, index) => { if (!pickup.visible) return; pickup.rotation.y += profile.reducedMotion ? 0.006 : 0.018; pickup.position.y = 0.55 + Math.sin(now * 0.002 + index) * (profile.reducedMotion ? 0.025 : 0.1); if (running && pickup.position.distanceTo(avatarGroup.position) < 0.74) collectShard(pickup) }); worldGroup.children.forEach(child => { if (child.userData.relic && running && child.position.distanceTo(avatarGroup.position) < 0.8) collectRelic(child) }) }
function updateCompanions(now: number): void { companionGroup.children.forEach((child, index) => { const base = child.userData.base as THREE.Vector3; const distanceToPlayer = child.position.distanceTo(avatarGroup.position); const follow = distanceToPlayer > 3 ? avatarGroup.position.clone().sub(child.position).multiplyScalar(0.008) : new THREE.Vector3(); child.position.x += follow.x; child.position.z += follow.z; child.position.y = base.y + Math.sin(now * 0.002 + index) * (profile.reducedMotion ? 0.02 : 0.14); child.rotation.y += 0.01 }) }
function animate(now: number): void { const dt = Math.min(0.04, (now - lastFrame) / 1000); lastFrame = now; updateMovement(dt, now); updatePickups(now); updateCompanions(now); updateLighting(now); const distance = 6.6; const target = new THREE.Vector3(avatarGroup.position.x + Math.sin(cameraYaw) * distance, 2.6 + cameraPitch * 2.1, avatarGroup.position.z + Math.cos(cameraYaw) * distance); camera.position.lerp(target, 1 - Math.pow(0.0008, dt)); camera.lookAt(avatarGroup.position.x, 1.25, avatarGroup.position.z); renderer.render(scene, camera); requestAnimationFrame(animate) }

function boot(): void { renderTab('lab'); buildAvatar(); buildWorld(); updateHUD(); renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); if (profile.reducedMotion) document.body.classList.add('reduced-motion'); if ('serviceWorker' in navigator && location.protocol !== 'file:') { const base = import.meta.env.BASE_URL; navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined) }; requestAnimationFrame(animate) }
boot()
