import { describe, expect, it, vi } from "vitest";

import { ensureGtagQueue, type GtagQueueTarget } from "./ga4-command-queue";

describe("Google Analytics gtag command queue", () => {
  it("queues native Arguments objects in the correct Consent Mode and page-view order", () => {
    const target: GtagQueueTarget = {};
    ensureGtagQueue(target);
    target.gtag?.("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied",
    });
    // No request or external script is created by queue initialization.
    expect(target.dataLayer).toHaveLength(1);
    target.gtag?.("consent", "update", { analytics_storage: "granted" });
    target.gtag?.("js", new Date("2026-11-15T10:00:00.000Z"));
    target.gtag?.("config", "G-Z54C7T331W", { send_page_view: false });
    target.gtag?.("event", "page_view", { page_path: "/fr" });
    const commands = target.dataLayer ?? [];
    expect(commands).toHaveLength(5);
    expect(commands.every((command) =>
      Object.prototype.toString.call(command) === "[object Arguments]"
    )).toBe(true);
    expect(commands.map((command) => Array.from(command as ArrayLike<unknown>)[0]))
      .toEqual(["consent", "consent", "js", "config", "event"]);
    expect(Array.from(commands[0] as ArrayLike<unknown>)).toEqual([
      "consent", "default", {
        analytics_storage: "denied", ad_storage: "denied",
        ad_user_data: "denied", ad_personalization: "denied",
      },
    ]);
    expect(Array.from(commands[4] as ArrayLike<unknown>)).toEqual([
      "event", "page_view", { page_path: "/fr" },
    ]);
  });

  it("is idempotent and never replaces an existing Google tag handler", () => {
    const existing = vi.fn();
    const target: GtagQueueTarget = { dataLayer: [{ preserved: true }], gtag: existing };
    ensureGtagQueue(target);
    ensureGtagQueue(target);
    target.gtag?.("event", "page_view");
    expect(target.gtag).toBe(existing);
    expect(existing).toHaveBeenCalledOnce();
    expect(target.dataLayer).toEqual([{ preserved: true }]);
  });

  it("preserves an existing queue on repeated initialization", () => {
    const target: GtagQueueTarget = {};
    ensureGtagQueue(target);
    const original = target.gtag;
    target.gtag?.("consent", "default", { analytics_storage: "denied" });
    ensureGtagQueue(target);
    expect(target.gtag).toBe(original);
    expect(target.dataLayer).toHaveLength(1);
  });
});
