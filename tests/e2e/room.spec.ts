import { expect, test, type Page, type Route } from "@playwright/test";
import { readWithRules } from "../../lib/ai/fallbackParser";

async function answer(route: Route) {
  const { text, ctx } = route.request().postDataJSON();
  await route.fulfill({ json: { result: readWithRules(text, ctx), source: "rules" } });
}

async function join(page: Page, start = "30 needed off 30") {
  await page.goto("/");
  await page.getByLabel("Your name in the chat").fill("Browser Fan");
  await page.getByRole("button", { name: start }).click();
  await page.getByRole("button", { name: "Start playing", exact: true }).click();
  await page.getByRole("button", { name: "Pause the match", exact: true }).click();
}

async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/read-message", answer);
  await page.route("**/api/report", (route) => route.fulfill({ json: { verdict: null } }));
});

test("a refresh restores the chat, call and exact score, with playback paused", async ({ page }) => {
  await join(page);
  await send(page, "India jeetega");
  await expect(page.getByText(/read by built-in reader/)).toBeVisible();
  await page.getByRole("button", { name: "Bowl the next ball now" }).click();
  const score = await page.locator("header").innerText();
  await page.reload();
  await expect(page.getByText(/read by built-in reader/)).toBeVisible();
  await expect(page.getByText("India jeetega", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume the match", exact: true })).toBeVisible();
  const restored = await page.locator("header").innerText();
  expect(restored.replace(" · Restored and paused", "")).toBe(score);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("restored-room.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Leave the chat" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Start playing", exact: true })).toBeVisible();
});

test("the final card waits for a late response and includes its points", async ({ page }) => {
  const pending: Route[] = [];
  await page.route("**/api/read-message", (route) => { pending.push(route); });
  await join(page, "The last over");
  await send(page, "India jeetega");
  await expect.poll(() => pending.length).toBe(1);
  for (let i = 0; i < 12; i++) {
    const next = page.getByRole("button", { name: "Bowl the next ball now" });
    if (!(await next.count())) break;
    await next.click();
  }
  await expect(page.getByRole("status")).toHaveText("Checking your last calls before the Pundit Card…");
  await expect(page.getByRole("button", { name: "Pundit card", exact: true })).toHaveCount(0);
  await answer(pending[0]);
  await page.getByRole("button", { name: "Pundit card", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Your pundit card" });
  await expect(card.locator("dl dd").nth(0)).toHaveText("1");
  await expect(card.locator("dl dd").nth(1)).toHaveText("1");
  await expect(card.locator("dl dd").nth(2)).toHaveText("+10");
  await page.screenshot({ path: test.info().outputPath("final-card.png"), fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("duplicate late responses award one wicket receipt", async ({ page }) => {
  const pending: Route[] = [];
  await page.route("**/api/read-message", (route) => { pending.push(route); });
  await join(page);
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Bowl the next ball now" }).click();
  for (let i = 0; i < 5; i++) await send(page, "wicket next ball");
  await expect.poll(() => pending.length).toBe(5);
  await page.getByRole("button", { name: "Bowl the next ball now" }).click();
  for (const route of pending.reverse()) await answer(route);
  await expect(page.getByRole("button", { name: "Share receipt", exact: true })).toHaveCount(1);
});

test("API rejects malformed report requests", async ({ request }) => {
  for (const calls of [[null], [{}], [42]]) {
    const response = await request.post("/api/report", { data: { calls } });
    expect(response.status()).toBe(400);
  }
});

test("a stalled AI request times out into the rules reader", async ({ page }) => {
  let requested = false;
  await page.clock.install();
  await page.route("**/api/read-message", () => { requested = true; });
  await join(page);
  await send(page, "India jeetega");
  await expect.poll(() => requested).toBe(true);
  await expect(page.getByText("third umpire is checking…")).toBeVisible();
  await page.clock.fastForward(15_001);
  await expect(page.getByText(/read by built-in reader/)).toBeVisible();
  await expect(page.getByText("third umpire is checking…")).toHaveCount(0);
});

test("the room and board work on a narrow phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await join(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open the board" }).click();
  const board = page.getByRole("dialog", { name: "Match board" });
  await expect(board.getByRole("heading", { name: "Bragging rights" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(board).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open the board" })).toBeFocused();
});
