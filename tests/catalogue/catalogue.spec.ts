import { expect, test } from '@playwright/test'
const id = '20000000-0000-4000-8000-000000000001'
test('real catalogue search, category, preview and plan review', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (let step = 0; step < 12; step++) {
    await page.keyboard.press('Shift+Tab')
    if (await page.getByRole('link', { name: 'Skip to content' }).evaluate(node => node === document.activeElement)) break
  }
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('heading', { name: 'The Quiet Orbit', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true })
  await page.getByRole('link', { name: 'Explore the library' }).click()
  await expect(page.getByRole('status')).toContainText('2 books found')
  await page.getByRole('button', { name: 'Fiction', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1 book found')
  await page.getByRole('button', { name: 'All books', exact: true }).click()
  await page.getByRole('searchbox').fill('garden')
  await expect(page.getByRole('heading', { name: 'A Small Garden of Time' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The Quiet Orbit' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('garden')
  await page.getByRole('searchbox').fill('nothing matches')
  await expect(page.getByRole('heading', { name: 'No books found' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'The Quiet Orbit' }) }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Quiet Orbit')
  await expect(page.getByText('Mara opened the observatory before dawn. The city below was still dark.', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: '7 days 2.00 USDT' }).check()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('details.png'), fullPage: true })
  await page.getByRole('link', { name: 'Review borrowing option' }).click()
  await expect(page.getByText('2.00 USDT', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Payment unavailable' })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
test('drafts and disabled plans cannot be selected', async ({ page }) => {
  await page.goto('/books/20000000-0000-4000-8000-000000000003')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book not found')
  await page.goto('/books/20000000-0000-4000-8000-000000000002')
  await expect(page.getByRole('radio')).toHaveCount(2)
  await page.goto('/checkout/20000000-0000-4000-8000-000000000002?plan=30000000-0000-4000-8000-000000000006')
  await expect(page.getByRole('heading', { name: 'Choose an available borrowing plan' })).toBeVisible()
})
test('catalogue network error is recoverable', async ({ page }) => {
  await page.route('**/rest/v1/books?*', route => route.abort())
  await page.goto('/explore')
  await expect(page.getByRole('alert')).toContainText('The catalogue could not load')
  await page.unroute('**/rest/v1/books?*')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'The Quiet Orbit' })).toBeVisible()
})
test('loading and empty catalogue have explicit states', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/rest/v1/books?*', async route => { await held; await route.fulfill({ json: [] }) })
  await page.goto('/explore')
  try { await expect(page.getByRole('status').filter({ hasText: 'Opening the library' })).toBeVisible() } finally { release() }
  await expect(page.getByRole('heading', { name: 'No books found' })).toBeVisible()
})
test('account and workspace screens are responsive and never fetch protected content', async ({ page }, info) => {
  const protectedRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/storage/v1/') || request.url().includes('/rest/v1/book_assets')) protectedRequests.push(request.url()) })
  for (const path of ['/library','/transactions',`/read/${id}`,'/admin','/contribute']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`${path.split('/')[1]}.png`), fullPage: true })
  }
  expect(protectedRequests).toEqual([])
})
