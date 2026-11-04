import { localOtp } from '../../scripts/lib/local-otp.mjs';
import { test, expect } from "@playwright/test";
test("local reader borrows, refreshes, reads, returns and sees history", async ({
  page,
}, info) => {
  const suffix = info.project.name.toUpperCase();
  await page.goto("/explore");
  const email=process.env[`SHELF_TEST_EMAIL_${suffix}`]!;
  await page.getByLabel('Email address',{exact:true}).fill(email);
  await page.getByRole('button',{name:'Send sign-in code'}).click();
  await page.getByLabel('Sign-in code',{exact:true}).fill(await localOtp(email));
  await page.getByRole('button',{name:'Verify email code'}).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: "The Quiet Orbit" }) })
    .click();
  await page.getByRole("radio", { name: "7 days 2.00 USDT" }).check();
  await page.getByRole("link", { name: "Review borrowing option" }).click();
  await page
    .getByRole("button", { name: "Create development checkout" })
    .click();
  await expect(page.getByText("Pending payment · 7 days")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Create development checkout" })
    .click();
  await page
    .getByRole("button", { name: "Simulate development payment" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Development payment confirmed" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open My Library" }).click();
  await page.getByRole("link", { name: "Read book", exact: true }).click();
  await expect(page).toHaveURL(/\/read\//);
  const readerUrl = page.url();
  await expect(
    page.getByText(/Mara opened the observatory before dawn/),
  ).toBeVisible();
  await page.screenshot({
    path: "supabase/.temp/reader-" + info.project.name + ".png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "My Library", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Return early" }).click();
  await page.getByRole("button", { name: "Confirm return" }).click();
  await page.getByRole("button", { name: "Reading history" }).click();
  await expect(
    page.getByRole("heading", { name: "The Quiet Orbit" }),
  ).toBeVisible();
  await page.goto(readerUrl);
  await expect(
    page.getByRole("heading", { name: "Reading access unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Mara opened the observatory before dawn/),
  ).toHaveCount(0);
  await page.goto("/transactions");
  await expect(
    page.getByText("Development simulation · No money moved"),
  ).toBeVisible();
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your payment history is private" }),
  ).toBeVisible();
});
