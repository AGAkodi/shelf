import { expect, test } from '@playwright/test'

const routes = [
  ['/', 'Discover, borrow, read'],
  ['/explore', 'Explore the library'],
  ['/books/route-check', 'Book details'],
  ['/checkout/route-check', 'Complete your borrowing'],
  ['/library', 'My Library'],
  ['/read/route-check', 'Reader'],
  ['/transactions', 'Transactions'],
  ['/admin', 'Admin dashboard'],
  ['/account', 'Account'],
  ['/contribute', 'Contribute your books'],
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
test('sidebar on desktop and tab bar on mobile navigate between sections', async ({ page }, testInfo) => {
  await page.goto('/')
  const mobile = testInfo.project.name === 'mobile'
  const nav = page.getByRole('navigation', { name: mobile ? 'Tabs' : 'Primary' })
  await expect(nav).toBeVisible()
  await expect(page.getByRole('navigation', { name: mobile ? 'Primary' : 'Tabs' })).not.toBeVisible()
  await nav.getByRole('link', { name: 'Explore', exact: true }).click()
  await expect(page).toHaveURL('/explore')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore the library')
  await expect(nav.getByRole('link', { name: 'Explore', exact: true })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Account')
  if (mobile) {
    for (const box of await nav.getByRole('link').evaluateAll(links => links.map(l => l.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44)
  } else {
    await page.keyboard.press('/')
    await expect(page.getByRole('searchbox', { name: 'Search books' }).first()).toBeFocused()
    await page.keyboard.type('orbit')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/explore?q=orbit')
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
