import { expect, test } from "@playwright/test";

test("free mode plays through a match without any AI endpoint requests", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  await page.goto("http://127.0.0.1:3101");
  await expect(page).toHaveTitle("Called It — Cricket calls. Real receipts.");
  await expect(page.getByRole("heading", { name: "CALL THE MATCH. KEEP THE RECEIPT." })).toBeVisible();
  await expect(page.getByText("Real match replay · 3 scripted bot opponents")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("product-home.png"), fullPage: true, animations: "disabled" });
  await page.getByLabel("Your name in the chat").fill("Free Fan");
  await page.getByRole("button", { name: "The last over" }).click();
  await page.getByRole("button", { name: "Start playing", exact: true }).click();
  await page.getByRole("button", { name: "Pause the match", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("India jeetega");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/read by built-in reader/)).toBeVisible();
  for (let i = 0; i < 12; i++) {
    const next = page.getByRole("button", { name: "Bowl the next ball now" });
    if (!(await next.count())) break;
    await next.click();
  }
  const card = page.getByRole("dialog", { name: "Your pundit card" });
  await expect(card).toBeVisible();
  await expect(card.locator("dl dd").nth(0)).toHaveText("1");
  await expect(card.locator("dl dd").nth(2)).toHaveText("+10");
  expect(apiRequests).toEqual([]);
});
