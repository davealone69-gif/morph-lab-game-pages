// Built-browser regression test for MORPH LAB.
// Serves dist/ beneath the configured base path, matching GitHub Pages project-site routing.
import { createServer } from 'node:http'
import { createReadStream, mkdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'

if (!existsSync('dist/index.html')) throw new Error('dist/index.html is missing; run pnpm build first')
if (!existsSync('dist/manifest.webmanifest')) throw new Error('dist/manifest.webmanifest is missing; run pnpm build first')
if (!existsSync('dist/sw.js')) throw new Error('dist/sw.js is missing; run pnpm build first')

const port = 4300 + Math.floor(Math.random() * 500)
const base = (process.env.PREVIEW_BASE ?? '/').replace(/^\/?/, '/').replace(/\/?$/, '/')
const url = `http://127.0.0.1:${port}${base}`
const shots = process.env.SHOTS_DIR ?? 'shots'
const dist = resolve('dist')
mkdirSync(shots, { recursive: true })
const facePath = join(tmpdir(), `morphlab-face-${process.pid}.svg`)
writeFileSync(facePath, `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#00ff00"/><circle cx="102" cy="110" r="9" fill="#251021"/><circle cx="154" cy="110" r="9" fill="#251021"/><path d="M95 158 Q128 188 161 158" fill="none" stroke="#8e2f53" stroke-width="8"/></svg>`)
const invalidPath = join(tmpdir(), `morphlab-invalid-${process.pid}.png`)
writeFileSync(invalidPath, 'This is not an image.')
const mime = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.webmanifest', 'application/manifest+json'], ['.json', 'application/json'], ['.png', 'image/png'], ['.ico', 'image/x-icon']])
const server = createServer((request, response) => {
  let pathname
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname) } catch { response.writeHead(400).end(); return }
  if (base !== '/' && pathname === base.slice(0, -1)) { response.writeHead(308, { Location: base }).end(); return }
  if (base !== '/' && !pathname.startsWith(base)) { response.writeHead(404).end(); return }
  const relativePath = pathname.slice(base === '/' ? 1 : base.length) || 'index.html'
  const filePath = resolve(dist, relativePath)
  if (filePath !== dist && !filePath.startsWith(`${dist}${sep}`)) { response.writeHead(403).end(); return }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) { response.writeHead(404).end(); return }
  response.writeHead(200, { 'Content-Type': mime.get(extname(filePath)) ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
  createReadStream(filePath).pipe(response)
})
server.listen(port, '127.0.0.1')
let browser
const errors = []
const guard = setTimeout(() => fail(new Error('smoke test timed out')), 120_000)
function cleanup() { clearTimeout(guard); try { server.close() } catch {}; try { rmSync(facePath, { force: true }) } catch {}; try { rmSync(invalidPath, { force: true }) } catch {} }
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
  if (await page.locator('#image-input').inputValue() !== '') throw new Error('image input was not cleared after selection')
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(shots, '01b-avatar-after-photo-upload.png') })
  await page.locator('#image-input').setInputFiles(invalidPath)
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent === 'Could not read that image. Try a JPG or PNG.')
  if (!(await page.locator('#portrait').evaluate(element => element.classList.contains('visible')))) throw new Error('invalid image replaced a valid face reference')
  await page.locator('#name-input').fill('REPAIR TEST')
  await page.locator('[data-action="morph"]').click()
  const saved = await page.evaluate(() => localStorage.getItem('morphlab.profile.v2'))
  if (!saved || !saved.includes('REPAIR TEST')) throw new Error('profile was not saved after morph')
  if (saved.includes('data:image')) throw new Error('face image was serialized into the profile save')

  await page.locator('[data-action="play"]').click()
  await page.waitForFunction(() => Number(document.querySelector('#shard-value')?.textContent ?? '0') > 0, null, { timeout: 5000 })
  await page.locator('[data-action="play"]').click()
  const shardProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('morphlab.profile.v2') ?? '{}').quests?.find(quest => quest.id === 'first-shards')?.progress)
  if (shardProgress !== 1) throw new Error(`first-shards quest progress was ${shardProgress}, expected 1`)

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
  await phonePage.locator('.mobile-nav [data-action="tab"][data-tab="lab"]').click()
  await phonePage.locator('#image-input').setInputFiles(facePath)
  await phonePage.waitForFunction(() => document.querySelector('#portrait')?.classList.contains('visible'))
  await phonePage.locator('.mobile-nav [data-action="tab"][data-tab="settings"]').click()
  phonePage.once('dialog', dialog => { void dialog.accept() })
  await phonePage.locator('[data-action="reset-profile"]').evaluate(element => element.click())
  await phonePage.waitForFunction(() => {
    const portrait = document.querySelector('#portrait')
    const placeholder = document.querySelector('#portrait-placeholder')
    return Boolean(portrait && !portrait.classList.contains('visible') && placeholder && !placeholder.classList.contains('hidden'))
  })
  await phone.close()

  if (errors.length) throw new Error(`browser errors:\n  ${errors.join('\n  ')}`)
  await browser.close(); cleanup(); console.log(`smoke: OK — desktop, Android-sized viewport, upload, 3D face screenshot, save, touch, and offline; screenshots in ${shots}/`)
} catch (error) { await fail(error) }
