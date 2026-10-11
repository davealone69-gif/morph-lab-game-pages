export type BodyType = 'slender' | 'athletic' | 'regal' | 'spectral'
export type HairStyle = 'raven' | 'twin-tails' | 'silver-bob' | 'crown'
export type OutfitId = 'crimson-jester' | 'rift-warden' | 'moon-priestess' | 'velvet-rogue'
export type Expression = 'calm' | 'sly' | 'fierce'
export type Personality = 'poetic' | 'playful' | 'stoic'
export type WorldId = 'blood-moon' | 'ashen-conservatory' | 'velvet-ruins'
export type WeatherId = 'clear' | 'rain' | 'embers' | 'mist'

export type QuestState = { id: string; progress: number; complete: boolean; claimed: boolean }

export type ProfileData = {
  version: 2
  name: string
  body: BodyType
  hair: HairStyle
  outfit: OutfitId
  expression: Expression
  personality: Personality
  level: number
  xp: number
  shards: number
  gold: number
  currentWorld: WorldId
  weather: WeatherId
  dayPhase: number
  visitedWorlds: WorldId[]
  inventory: OutfitId[]
  collectibles: string[]
  achievements: string[]
  quests: QuestState[]
  reducedMotion: boolean
  lowPower: boolean
  adultAtmosphere: boolean
  soundOn: boolean
  seenTutorial: boolean
}

export const PROFILE_KEY = 'morphlab.profile.v2'

export const QUESTS: ReadonlyArray<{ id: string; title: string; description: string; target: number; reward: number }> = [
  { id: 'first-shards', title: 'Glass in the Dark', description: 'Collect moon shards in any world.', target: 8, reward: 120 },
  { id: 'world-walker', title: 'Three Thresholds', description: 'Visit every arena.', target: 3, reward: 250 },
  { id: 'wardrobe', title: 'A Different Silhouette', description: 'Equip three different outfits.', target: 3, reward: 180 },
]

export function defaultProfile(): ProfileData {
  return {
    version: 2,
    name: 'NIGHTSHADE', body: 'athletic', hair: 'raven', outfit: 'crimson-jester', expression: 'sly', personality: 'poetic',
    level: 1, xp: 0, shards: 0, gold: 80, currentWorld: 'blood-moon', weather: 'clear', dayPhase: 0.08,
    visitedWorlds: ['blood-moon'], inventory: ['crimson-jester', 'rift-warden', 'moon-priestess', 'velvet-rogue'],
    collectibles: [], achievements: [], quests: QUESTS.map(q => ({ id: q.id, progress: 0, complete: false, claimed: false })),
    reducedMotion: false, lowPower: false, adultAtmosphere: true, soundOn: true, seenTutorial: false,
  }
}

const bodies: BodyType[] = ['slender', 'athletic', 'regal', 'spectral']
const hairs: HairStyle[] = ['raven', 'twin-tails', 'silver-bob', 'crown']
const outfits: OutfitId[] = ['crimson-jester', 'rift-warden', 'moon-priestess', 'velvet-rogue']
const expressions: Expression[] = ['calm', 'sly', 'fierce']
const personalities: Personality[] = ['poetic', 'playful', 'stoic']
const worlds: WorldId[] = ['blood-moon', 'ashen-conservatory', 'velvet-ruins']
const weather: WeatherId[] = ['clear', 'rain', 'embers', 'mist']
const stringOr = (value: unknown, fallback: string, max = 18) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
const numberOr = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
const enumOr = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback

export function parseProfile(raw: string | null): ProfileData {
  const base = defaultProfile()
  if (!raw) return base
  let data: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
    data = parsed as Record<string, unknown>
  } catch { return base }
  if (data.version !== 2) return base
  const loadedQuests = Array.isArray(data.quests) ? data.quests : []
  const quests = QUESTS.map(q => {
    const found = loadedQuests.find(item => item && typeof item === 'object' && (item as QuestState).id === q.id) as QuestState | undefined
    return { id: q.id, progress: numberOr(found?.progress, 0, 0, q.target), complete: found?.complete === true || numberOr(found?.progress, 0, 0, q.target) >= q.target, claimed: found?.claimed === true }
  })
  const visits = Array.isArray(data.visitedWorlds) ? data.visitedWorlds.filter(v => worlds.includes(v as WorldId)) as WorldId[] : base.visitedWorlds
  return {
    version: 2,
    name: stringOr(data.name, base.name),
    body: enumOr(data.body, bodies, base.body), hair: enumOr(data.hair, hairs, base.hair), outfit: enumOr(data.outfit, outfits, base.outfit),
    expression: enumOr(data.expression, expressions, base.expression), personality: enumOr(data.personality, personalities, base.personality),
    level: Math.floor(numberOr(data.level, base.level, 1, 99)), xp: Math.floor(numberOr(data.xp, base.xp, 0, 999999)),
    shards: Math.floor(numberOr(data.shards, base.shards, 0, 999999)), gold: Math.floor(numberOr(data.gold, base.gold, 0, 999999)),
    currentWorld: enumOr(data.currentWorld, worlds, base.currentWorld), weather: enumOr(data.weather, weather, base.weather),
    dayPhase: numberOr(data.dayPhase, base.dayPhase, 0, 1),
    visitedWorlds: [...new Set(visits)].slice(0, worlds.length),
    inventory: Array.isArray(data.inventory) ? [...new Set(data.inventory.filter(v => outfits.includes(v as OutfitId)) as OutfitId[])] : base.inventory,
    collectibles: Array.isArray(data.collectibles) ? [...new Set(data.collectibles.filter(v => typeof v === 'string').map(v => v.slice(0, 60)))] : [],
    achievements: Array.isArray(data.achievements) ? [...new Set(data.achievements.filter(v => typeof v === 'string').map(v => v.slice(0, 60)))] : [],
    quests, reducedMotion: data.reducedMotion === true, lowPower: data.lowPower === true, adultAtmosphere: data.adultAtmosphere !== false,
    soundOn: data.soundOn !== false, seenTutorial: data.seenTutorial === true,
  }
}

export class ProfileStore {
  data: ProfileData
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
    let raw: string | null = null
    try { raw = this.storage?.getItem(PROFILE_KEY) ?? null } catch { raw = null }
    this.data = parseProfile(raw)
  }
  save(): void {
    try { this.storage?.setItem(PROFILE_KEY, JSON.stringify(this.data)) } catch { /* Private mode still works in memory. */ }
  }
  update(patch: Partial<ProfileData>): void { this.data = { ...this.data, ...patch }; this.save() }
  reset(): void { this.data = defaultProfile(); this.save() }
}

export function xpForLevel(level: number): number { return 180 + (level - 1) * 90 }

export function addXp(profile: ProfileData, amount: number): { leveled: boolean; level: number } {
  profile.xp += Math.max(0, Math.floor(amount))
  let leveled = false
  while (profile.xp >= xpForLevel(profile.level) && profile.level < 99) { profile.xp -= xpForLevel(profile.level); profile.level += 1; leveled = true }
  return { leveled, level: profile.level }
}
