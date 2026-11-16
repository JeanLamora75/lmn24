import { expect, test } from "@playwright/test";

/**
 * SCRUM-110 — self-contained browser acceptance on the server-rendered
 * horoscope index, so the test does not depend on the articles/weather backend.
 */
test("SCRUM-110: keyboard-only dialog, city suggestions and narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route("**/api/public/visitor-cities?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cities: [{
        provider: "open-meteo-geocoding", providerId: "2988507",
        name: "Paris", region: "Île-de-France", countryIso2: "FR", continent: "EU",
        latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris",
      }] }),
    }),
  );
  await page.goto("/fr/horoscope");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  const trigger = page.getByRole("button", { name: "Mes préférences" });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Fermer" })).toBeFocused();
  await dialog.getByLabel("Pays").selectOption("FR");
  const input = dialog.getByRole("combobox", { name: "Rechercher une ville" });
  await input.fill("Paris");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", /option-0$/);
  await input.press("Enter");
  await expect(dialog.getByText("Ville sélectionnée:")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect.poll(async () => page.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth,
  )).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("lmn24.visitorPreferences"))).toBeNull();
});

test("SCRUM-110: storage forbidden never crashes public pages or claims successful save", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "lmn24.visitorPreferences") throw new DOMException("blocked", "SecurityError");
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "lmn24.visitorPreferences") throw new DOMException("blocked", "SecurityError");
      return originalSet.call(this, key, value);
    };
  });
  await page.goto("/fr/horoscope");
  await expect(page.getByRole("heading", { name: "Horoscope" })).toBeVisible();
  await page.getByRole("button", { name: "Mes préférences" }).click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await dialog.getByRole("radio", { name: "Sombre" }).check();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText(
    "Impossible d'enregistrer dans ce navigateur.",
  );
  await expect(page.locator("html")).not.toHaveAttribute("data-bs-theme", "dark");
});

test("SCRUM-110: cross-tab edits cannot silently overwrite an open draft", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" });
  try {
    const first = await context.newPage();
    await first.goto("/fr/horoscope");
    await first.getByRole("button", { name: "Mes préférences" }).click();
    const firstDialog = first.getByRole("dialog", { name: "Mes préférences" });
    await firstDialog.getByRole("radio", { name: "Clair" }).check();
    await firstDialog.getByRole("button", { name: "Enregistrer" }).click();

    const second = await context.newPage();
    await second.goto("/fr/horoscope");
    await second.getByRole("button", { name: "Mes préférences" }).click();
    const secondDialog = second.getByRole("dialog", { name: "Mes préférences" });
    await secondDialog.getByRole("radio", { name: "Sombre" }).check();

    await first.getByRole("button", { name: "Mes préférences" }).click();
    await firstDialog.getByRole("radio", { name: "Automatique" }).check();
    await firstDialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect(secondDialog.getByRole("alert")).toContainText(
      "Les préférences ont changé dans un autre onglet.",
    );
    await expect(secondDialog.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    await secondDialog.getByRole("button", { name: "Annuler" }).click();
    await second.getByRole("button", { name: "Mes préférences" }).click();
    await expect(secondDialog.getByRole("radio", { name: "Automatique" })).toBeChecked();
  } finally {
    await context.close();
  }
});

test("SCRUM-110: private date stays out of URLs and requests, canonical remains public", async ({ page }) => {
  const leaks: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("lmn24.visitorPreferences", JSON.stringify({
      version: 1, theme: "dark", countryIso2: null, city: null, birthDate: "1992-05-21",
    }));
  });
  page.on("request", (request) => {
    if (request.url().includes("1992-05-21") ||
      (request.postData() ?? "").includes("1992-05-21")) leaks.push(request.url());
  });
  await page.goto("/fr/horoscope");
  await expect(page.locator('[data-favorite-sign="true"]')).toHaveAttribute(
    "href", "/fr/horoscope/gemini",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fr\/horoscope/);
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(8);
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  expect(leaks).toEqual([]);
});

const localePreferences: Record<string, { trigger: string; badge: string }> = {
  fr: { trigger: "Mes préférences", badge: "Mon signe" },
  en: { trigger: "My preferences", badge: "My sign" },
  de: { trigger: "Meine Einstellungen", badge: "Mein Sternzeichen" },
  es: { trigger: "Mis preferencias", badge: "Mi signo" },
  pt: { trigger: "As minhas preferências", badge: "O meu signo" },
  it: { trigger: "Le mie preferenze", badge: "Il mio segno" },
  ru: { trigger: "Мои предпочтения", badge: "Мой знак" },
  nl: { trigger: "Mijn voorkeuren", badge: "Mijn sterrenbeeld" },
};
for (const [locale, copy] of Object.entries(localePreferences)) {
  test("SCRUM-110: public preferences localized in " + locale, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lmn24.visitorPreferences", JSON.stringify({
        version: 1, theme: null, countryIso2: null, city: null, birthDate: "2000-02-29",
      }));
    });
    await page.goto("/" + locale + "/horoscope");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator('[data-favorite-sign="true"]')).toContainText(copy.badge);
    const action = page.getByRole("button", { name: copy.trigger });
    await expect(action).toBeVisible();
    await action.click();
    await expect(page.getByRole("dialog", { name: copy.trigger })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("SCRUM-110: dark-mode card text retains at least WCAG AA contrast", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lmn24.visitorPreferences", JSON.stringify({
      version: 1, theme: "dark", countryIso2: null, city: null, birthDate: "2000-02-29",
    }));
  });
  await page.goto("/fr/horoscope");
  const contrast = await page.locator('[data-favorite-sign="true"] h2').evaluate((node) => {
    const color = (value: string) => {
      const parts = value.match(/[\\d.]+/g)?.map(Number) ?? [];
      const rgb = parts.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const textColor = getComputedStyle(node).color;
    const backgroundColor = getComputedStyle(node.closest("a")!).backgroundColor;
    const a = color(textColor), b = color(backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
