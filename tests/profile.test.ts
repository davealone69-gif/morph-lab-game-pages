import { describe, expect, it } from 'vitest'
import { addXp, defaultProfile, parseProfile, xpForLevel } from '../src/engine/profile'

describe('profile', () => {
  it('falls back safely for missing, corrupt, foreign, and invalid enum data', () => {
    expect(parseProfile(null)).toEqual(defaultProfile())
    expect(parseProfile('{broken')).toEqual(defaultProfile())
    expect(parseProfile(JSON.stringify({ version: 1 }))).toEqual(defaultProfile())
    const parsed = parseProfile(JSON.stringify({ version: 2, body: 'giant', currentWorld: 'moon', quests: [{ id: 'first-shards', progress: 999 }] }))
    expect(parsed.body).toBe('athletic')
    expect(parsed.currentWorld).toBe('blood-moon')
    expect(parsed.quests[0].progress).toBe(8)
    expect(parsed.quests[0].complete).toBe(true)
  })

  it('deduplicates visited worlds, inventory, relics, and achievements', () => {
    const parsed = parseProfile(JSON.stringify({ version: 2, visitedWorlds: ['blood-moon', 'blood-moon', 'velvet-ruins'], inventory: ['moon-priestess', 'moon-priestess'], collectibles: ['a', 'a'], achievements: ['x', 'x'] }))
    expect(parsed.visitedWorlds).toEqual(['blood-moon', 'velvet-ruins'])
    expect(parsed.inventory).toEqual(['moon-priestess'])
    expect(parsed.collectibles).toEqual(['a'])
    expect(parsed.achievements).toEqual(['x'])
  })

  it('levels up while retaining overflow XP', () => {
    const profile = defaultProfile()
    const result = addXp(profile, xpForLevel(1) + 12)
    expect(result.leveled).toBe(true)
    expect(profile.level).toBe(2)
    expect(profile.xp).toBe(12)
  })
})
