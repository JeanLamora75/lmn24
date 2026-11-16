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
    await expect(dialog.getByRole("button").first()).toBeFocused();
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

test("SCRUM-105 cancel and Escape discard changes without writing storage", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await dialog.getByRole("radio", { name: "Sombre" }).check();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lmn24.visitorPreferences"))).toBeNull();
  await page.getByRole("button", { name: "Mes préférences" }).click();
  await expect(dialog.getByRole("radio", { name: "Clair" })).toBeChecked();
  await dialog.getByRole("radio", { name: "Sombre" }).check();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lmn24.visitorPreferences"))).toBeNull();
});

test("SCRUM-105 saves explicitly and reset actions stay draft until Save", async ({ page }) => {
  await page.goto("/fr");
  const open = () => page.getByRole("button", { name: "Mes préférences" }).click();
  await open();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await dialog.getByRole("radio", { name: "Sombre" }).check();
  await dialog.getByLabel("Pays").selectOption("FR");
  await dialog.getByLabel("Date de naissance").fill("2000-02-29");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Préférences enregistrées." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const s = localStorage.getItem("lmn24.visitorPreferences");
    return s ? JSON.parse(s).birthDate : null;
  })).toBe("2000-02-29");
  await open();
  await expect(dialog.getByRole("radio", { name: "Sombre" })).toBeChecked();
  await expect(dialog.getByLabel("Pays")).toHaveValue("FR");
  await dialog.getByRole("button", { name: "Tout réinitialiser" }).click();
  await expect(dialog.getByText("Réinitialiser toutes les préférences ?")).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler" }).first().click();
  await expect(dialog.getByRole("radio", { name: "Sombre" })).toBeChecked();
  await dialog.getByRole("button", { name: "Tout réinitialiser" }).click();
  await dialog.getByRole("button", { name: "Tout réinitialiser" }).first().click();
  await expect(dialog.getByRole("radio", { name: "Clair" })).toBeChecked();
  await dialog.getByRole("button", { name: "Annuler" }).last().click();
  await open();
  await expect(dialog.getByRole("radio", { name: "Sombre" })).toBeChecked();
  await dialog.getByRole("button", { name: "Tout réinitialiser" }).click();
  await dialog.getByRole("button", { name: "Tout réinitialiser" }).first().click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect.poll(() => page.evaluate(() => {
    const s = localStorage.getItem("lmn24.visitorPreferences");
    return s ? JSON.parse(s).countryIso2 : "missing";
  })).toBeNull();
});

test("SCRUM-105 local validation rejects an invalid birthdate", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await dialog.getByLabel("Date de naissance").fill("2027-01-01");
  await expect(dialog.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Annuler" }).click();
});

test("SCRUM-106 never changes the theme until preferences are saved", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("html")).not.toHaveAttribute("data-bs-theme", "dark");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await expect(dialog.getByRole("radio", { name: "Clair" })).toBeChecked();
  await dialog.getByRole("radio", { name: "Sombre" }).check();
  await expect(page.locator("html")).not.toHaveAttribute("data-bs-theme", "dark");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-bs-theme", "dark");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  await dialog.getByRole("radio", { name: "Sombre" }).check();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(222, 226, 230)");
});

test("SCRUM-106 automatic theme follows system preferences and resets cleanly", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/fr");
  await expect(page.locator("html")).not.toHaveAttribute("data-bs-theme", "dark");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await dialog.getByRole("radio", { name: "Automatique" }).check();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  await dialog.getByRole("button", { name: "Tout réinitialiser" }).click();
  await dialog.getByRole("button", { name: "Tout réinitialiser" }).first().click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-bs-theme");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).not.toHaveAttribute("data-bs-theme");
});

test("SCRUM-106 theme survives locale change without changing the URL canonical", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await dialog.getByRole("radio", { name: "Sombre" }).check();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await page.goto("/en/horoscope");
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp("en/horoscope"));
});
