import { expect, test } from "@playwright/test";

/**
 * Mobile date navigation keeps its centered heading position even if one arrow
 * is unavailable. The existing 8 date buttons remain available on desktop.
 */
for (const width of [320, 390, 768, 1280]) {
  test(`Horoscope sign: responsive date navigation and no footer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/fr/horoscope/virgo");

    await expect(page.getByRole("heading", { name: "Horoscope — Vierge" })).toBeVisible();
    await expect(page.getByText("Contenu astrologique proposé à des fins de divertissement.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Astronomical data: CosmyDay/i })).toHaveCount(0);
    await expect(page.locator('article a[href*="cosmyday.com"]')).toHaveCount(0);

    const dateNav = page.getByRole("navigation", { name: "Choisir une date" });
    const buttons = dateNav.getByRole("link");
    if (width >= 768) {
      await expect(buttons).toHaveCount(8);
      await expect(page.locator('nav[class*="mobileDateNavigation"]')).toBeHidden();
      return;
    }

    await expect(buttons).toHaveCount(1);
    const mobile = page.locator('nav[class*="mobileDateNavigation"]');
    const date = mobile.locator("time");
    await expect(date).toBeVisible();

    async function assertCentered() {
      const positions = await mobile.evaluate(element => {
        const nav = element.getBoundingClientRect();
        const heading = element.querySelector("h2")!.getBoundingClientRect();
        return { navCenter: nav.left + nav.width / 2, dateCenter: heading.left + heading.width / 2 };
      });
      expect(Math.abs(positions.navCenter - positions.dateCenter)).toBeLessThanOrEqual(1);
      await expect(mobile.locator('a svg')).toHaveCount(await buttons.count());
    }

    await assertCentered();
    const initial = await date.getAttribute("datetime");
    await buttons.first().click();
    await expect(date).not.toHaveAttribute("datetime", initial!);
    await expect(buttons).toHaveCount(2);
    await assertCentered();

    // Walk to the last available day: the right-hand slot remains reserved.
    for (let i = 0; i < 6; i++) {
      const before = await date.getAttribute("datetime");
      await mobile.getByRole("link").last().click();
      await expect(date).not.toHaveAttribute("datetime", before!);
    }
    await expect(buttons).toHaveCount(1);
    await assertCentered();
    const lastDate = await date.getAttribute("datetime");
    await buttons.first().click();
    await expect(date).not.toHaveAttribute("datetime", lastDate!);
    await expect(buttons).toHaveCount(2);
    await assertCentered();
  });
}
