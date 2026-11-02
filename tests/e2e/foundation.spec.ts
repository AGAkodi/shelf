import { expect, test } from '@playwright/test'

const routes = [
  ['/', 'Your next great read'],
  ['/explore', 'Explore the library'],
  ['/books/route-check', 'Book details'],
  ['/checkout/route-check', 'Payment / Checkout'],
  ['/library', 'My Library'],
  ['/read/route-check', 'Reading Interface'],
  ['/transactions', 'Transactions'],
  ['/admin', 'Admin Dashboard'],
  ['/contribute', 'Contributor Application'],
  ['/unknown-route', 'Page not found'],
] as const

for (const [path, heading] of routes) {
  test(`direct route ${path} renders without errors or overflow`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
    await expect(page.getByLabel('Configuration status')).toBeVisible()
    await expect(page).toHaveTitle(/Shelf/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (path === '/') await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
    expect(errors).toEqual([])
  })
}
test('navigation works and mobile disclosure closes after selection', async ({ page }, testInfo) => {
  await page.goto('/')
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click()
  }
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Explore', exact: true }).click()
  await expect(page).toHaveURL('/explore')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore the library')
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('navigation', { name: 'Primary' })).not.toBeVisible()
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  }
})

test('lazy route startup exposes a loading state', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/pages/ExplorePage.tsx*', async route => {
    await held
    await route.continue()
  })
  await page.goto('/explore', { waitUntil: 'commit' })
  try {
    await expect(page.getByRole('status').filter({ hasText: 'Loading page' })).toBeVisible()
  } finally { release() }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore the library')
})
