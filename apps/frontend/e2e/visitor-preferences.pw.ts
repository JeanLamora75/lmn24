import { test, expect } from "@playwright/test";

const names: Record<string, string> = {
  fr: "Mes préférences", en: "My preferences", de: "Meine Einstellungen",
  es: "Mis preferencias", pt: "As minhas preferências", it: "Le mie preferenze",
  ru: "Мои предпочтения", nl: "Mijn voorkeuren",
};

for (const [locale, title] of Object.entries(names)) {
  test("SCRUM-104 header and modal in " + locale, async ({ page }) => {
    await page.goto("/" + locale);
    const preferences = page.getByRole("button", { name: title, exact: true });
    await expect(preferences).toBeVisible();
    await expect(page.getByRole("dialog", { name: title })).toHaveCount(0);
    await expect(preferences).toHaveAttribute("aria-haspopup", "dialog");
    await preferences.click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(preferences).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("button")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(preferences).toBeFocused();
    await expect(preferences).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(new RegExp("/" + locale + "/?$"));
  });
}

test("SCRUM-104 preferences coexist with the language switcher", async ({ page }) => {
  await page.goto("/fr");
  const preferences = page.getByRole("button", { name: "Mes préférences", exact: true });
  await preferences.click();
  await expect(page.getByRole("dialog", { name: "Mes préférences" })).toBeVisible();
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const languages = page.getByRole("button", { name: "Français", exact: true });
  await languages.click();
  await expect(page.getByRole("menu")).toBeVisible();
});
