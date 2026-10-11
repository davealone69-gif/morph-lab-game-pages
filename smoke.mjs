// Built-browser regression test for MORPH LAB.
// The production build must exist in dist/ before this script runs.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'

if (!existsSync('dist/index.html')) throw new Error('dist/index.html is missing; run pnpm build first')
if (!existsSync('dist/manifest.webmanifest')) throw new Error('dist/manifest.webmanifest is missing; run pnpm build first')
if (!existsSync('dist/sw.js')) throw new Error('dist/sw.js is missing; run pnpm build first')

const port = 4300 + Math.floor(Math.random() * 500)
const base = (process.env.PREVIEW_BASE ?? '/').replace(/^\/?/, '/').replace(/\/?$/, '/')
const url = `http://127.0.0.1:${port}${base}`
const shots = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(shots, { recursive: true })
const facePath = join(tmpdir(), `morphlab-face-${process.pid}.svg`)
writeFileSync(facePath, `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#26102c"/><circle cx="128" cy="118" r="72" fill="#e4b0a0"/><circle cx="102" cy="110" r="9" fill="#251021"/><circle cx="154" cy="110" r="9" fill="#251021"/><path d="M95 158 Q128 188 161 158" fill="none" stroke="#8e2f53" stroke-width="8"/></svg>`)
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
let browser
const errors = []
const guard = setTimeout(() => fail(new Error('smoke test timed out')), 120_000)
function cleanup() { clearTimeout(guard); try { server.kill('SIGTERM') } catch {}; try { rmSync(facePath, { force: true }) } catch {} }
async function fail(error) { console.error(`smoke: FAIL — ${error.message}\n${error.stack ?? ''}${errors.length ? `\n${errors.join('\n')}` : ''}`); await browser?.close().catch(() => {}); cleanup(); process.exit(1) }
async function waitForServer() { for (let i = 0; i < 80; i += 1) { try { if ((await fetch(url)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 250)) } throw new Error('preview server did not start') }
function observe(page) { page.on('console', message => message.type() === 'error' && errors.push(`console: ${message.text()}`)); page.on('pageerror', error => errors.push(`pageerror: ${error.message}`)); page.on('response', response => response.status() >= 400 && response.text().then(body => errors.push(`HTTP ${response.status()} ${response.url()} :: ${body}`))) }
async function boot(context) { const page = await context.newPage(); observe(page); await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForSelector('#scene-title'); await page.waitForSelector('#screen-content'); await page.waitForTimeout(500); return page }
async function clickTab(page, tab) { await page.locator(`[data-action="tab"][data-tab="${tab}"]`).first().click() }

try {
  await waitForServer()
  browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--ignore-gpu-blocklist'] })

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await boot(desktop)
  if (await page.locator('#scene-title').innerText() !== 'BLOOD MOON GARDEN') throw new Error('world scene did not boot')
  if (!(await page.locator('.upload-zone').innerText()).includes('2D face texture')) throw new Error('photo-to-3D limitation is not disclosed in the UI')
  await page.screenshot({ path: join(shots, '01-desktop-lab.png') })

  await page.locator('#image-input').setInputFiles(facePath)
  await page.waitForFunction(() => document.querySelector('#portrait')?.classList.contains('visible'))
  await page.locator('#name-input').fill('REPAIR TEST')
  await page.locator('[data-action="morph"]').click()
  const saved = await page.evaluate(() => localStorage.getItem('morphlab.profile.v2'))
  if (!saved || !saved.includes('REPAIR TEST')) throw new Error('profile was not saved after morph')
  if (saved.includes('data:image')) throw new Error('face image was serialized into the profile save')

  await clickTab(page, 'wardrobe')
  await page.locator('[data-action="outfit"][data-outfit="moon-priestess"]').click()
  if (!(await page.locator('#profile-archetype').innerText()).includes('MOON PRIESTESS')) throw new Error('wardrobe selection did not update dossier')
  await clickTab(page, 'world')
  await page.locator('[data-action="world"][data-world="velvet-ruins"]').click()
  if (await page.locator('#scene-title').innerText() !== 'VELVET RUINS') throw new Error('world selection did not update scene')
  await clickTab(page, 'settings')
  await page.locator('[data-setting="reducedMotion"]').check()
  if (!(await page.locator('[data-setting="reducedMotion"]').isChecked())) throw new Error('reduced-motion setting did not persist in UI')
  await clickTab(page, 'lab')
  await page.locator('[data-action="play"]').click()
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(450); await page.keyboard.up('ArrowRight')
  if (await page.locator('#mode-pill').innerText() !== 'EXPLORATION') throw new Error('keyboard exploration did not start')
  await page.screenshot({ path: join(shots, '02-desktop-exploration.png') })
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 10_000 })
  await desktop.setOffline(true)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('#scene-title')
  if (await page.locator('#scene-title').innerText() !== 'VELVET RUINS') throw new Error('offline reopening did not render the saved world')
  await desktop.setOffline(false)
  await page.reload({ waitUntil: 'networkidle' })
  if (await page.locator('#profile-name').innerText() !== 'REPAIR TEST') throw new Error('saved avatar name did not survive reload')
  await desktop.close()

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  const phonePage = await boot(phone)
  await phonePage.locator('.mobile-nav [data-action="tab"][data-tab="wardrobe"]').click()
  await phonePage.locator('[data-action="outfit"][data-outfit="rift-warden"]').evaluate(element => element.click())
  await phonePage.locator('.mobile-nav [data-action="tab"][data-tab="lab"]').click()
  await phonePage.locator('[data-action="play"]').evaluate(element => element.click())
  await phonePage.locator('#dash-button').tap()
  const joystick = phonePage.locator('#joystick')
  const box = await joystick.boundingBox()
  if (!box) throw new Error('Android joystick is not visible')
  await joystick.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 })
  await phonePage.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: x + 30, clientY: y, bubbles: true })), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  await phonePage.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', bubbles: true })))
  if (await phonePage.locator('#mode-pill').innerText() !== 'EXPLORATION') throw new Error('Android touch controls did not enter exploration')
  await phonePage.screenshot({ path: join(shots, '03-android-exploration.png') })
  await phone.close()



  if (errors.length) throw new Error(`browser errors:\n  ${errors.join('\n  ')}`)
  await browser.close(); cleanup(); console.log(`smoke: OK — desktop, Android, upload, save, touch, and offline; screenshots in ${shots}/`)
} catch (error) { await fail(error) }
