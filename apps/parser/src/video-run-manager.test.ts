import { describe, expect, it, vi } from "vitest";
import { ActiveRunError, RunManager } from "./run-manager.js";
import type { ParserEvent, ParserFilters } from "./parser-engine.js";

describe("SCRUM-46 video run lifecycle", () => {
  it("rejects parallel starts, replays video SSE events and permits the next run after completion", async () => {
    let complete: (() => void) | undefined;
    const engine = { run: vi.fn(async (_filters: ParserFilters, emit: (event: ParserEvent) => void) => {
      emit({ type: "run-started", timestamp: "2026-10-13T10:00:00.000Z", message: "Collecte vidéo" });
      await new Promise<void>(resolve => { complete = resolve; });
      emit({ type: "run-completed", timestamp: "2026-10-13T10:00:01.000Z", message: "Terminé" });
    }) };
    const manager = new RunManager(engine);
    const id = manager.start({ languageIsoCode2: "pt" });
    expect(() => manager.start({})).toThrow(ActiveRunError);
    const messages: string[] = [];
    const subscription = manager.subscribe(id, event => messages.push(event.message));
    expect(subscription?.events[0]?.type).toBe("run-started");
    expect(subscription?.done).toBe(false);
    complete?.();
    await vi.waitFor(() => expect(manager.subscribe(id, () => undefined)?.done).toBe(true));
    expect(messages).toContain("Terminé");
    subscription?.unsubscribe();
    const next = manager.start({ languageIsoCode2: "de" });
    expect(next).not.toBe(id);
    complete?.();
    await vi.waitFor(() => expect(manager.subscribe(next, () => undefined)?.done).toBe(true));
    expect(engine.run).toHaveBeenCalledTimes(2);
  });
});
