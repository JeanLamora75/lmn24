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

test("SCRUM-107 city search is country-filtered, distinguishes homonyms and only saves chosen city", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/public/visitor-cities?**", async (route) => {
    calls++;
    const request = new URL(route.request().url());
    expect(request.searchParams.get("country")).toBe("FR");
    expect(request.searchParams.get("locale")).toBe("fr");
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ cities: [
        { provider:"open-meteo-geocoding",providerId:"2988507",name:"Paris",region:"Île-de-France",
          countryIso2:"FR",continent:"EU",latitude:48.8566,longitude:2.3522,timezone:"Europe/Paris" },
        { provider:"open-meteo-geocoding",providerId:"777777",name:"Paris",region:"Auvergne",
          countryIso2:"FR",continent:"EU",latitude:45.1,longitude:3.8,timezone:"Europe/Paris" },
      ] }) });
  });
  await page.goto("/fr");
  const preferencesButton = page.getByRole("button", { name: "Mes préférences" });
  await preferencesButton.click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  const citySearch = dialog.getByRole("combobox", { name: "Rechercher une ville" });
  await expect(citySearch).toBeDisabled();
  await dialog.getByLabel("Pays").selectOption("FR");
  await expect(citySearch).toBeEnabled();
  await citySearch.fill("Paris");
  const options = dialog.getByRole("option");
  await expect(options).toHaveCount(2);
  await dialog.getByRole("option", { name: "Paris, Île-de-France, FR" }).click();
  await expect(dialog.getByText("Ville sélectionnée:")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lmn24.visitorPreferences"))).toBeNull();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await preferencesButton.click();
  await expect(dialog.getByText("Ville sélectionnée:")).toHaveCount(0);
  await dialog.getByLabel("Pays").selectOption("FR");
  await dialog.getByRole("combobox", { name: "Rechercher une ville" }).fill("Paris");
  await dialog.getByRole("option", { name: "Paris, Île-de-France, FR" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect.poll(() => page.evaluate(() => {
    const snapshot = localStorage.getItem("lmn24.visitorPreferences");
    return snapshot ? JSON.parse(snapshot).city?.providerId : null;
  })).toBe("2988507");
  expect(calls).toBeGreaterThanOrEqual(2);
  await preferencesButton.click();
  await expect(dialog.getByText("Paris, Île-de-France, FR")).toBeVisible();
  await dialog.getByLabel("Pays").selectOption("DE");
  await expect(dialog.getByText("Ville sélectionnée:")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect.poll(() => page.evaluate(() => {
    const snapshot = localStorage.getItem("lmn24.visitorPreferences");
    return snapshot ? JSON.parse(snapshot).city : "missing";
  })).toBeNull();
});

test("SCRUM-107 shows empty and rate-limit states without saving arbitrary input", async ({ page }) => {
  await page.route("**/api/public/visitor-cities?**", async (route) =>
    route.fulfill({ status: 429, contentType: "application/json", body: '{"error":"rate-limited"}' }));
  await page.goto("/fr");
  await page.getByRole("button", { name: "Mes préférences" }).click();
  const dialog = page.getByRole("dialog", { name: "Mes préférences" });
  await dialog.getByLabel("Pays").selectOption("FR");
  await dialog.getByRole("combobox", { name: "Rechercher une ville" }).fill("Paris");
  await expect(dialog.getByText("Trop de recherches. Réessayez ultérieurement.")).toBeVisible();
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("lmn24.visitorPreferences");
    return raw ? JSON.parse(raw).city : "missing";
  })).toBeNull();
});
