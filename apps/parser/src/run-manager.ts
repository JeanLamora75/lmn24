import { randomUUID } from "node:crypto";
import type { Trigger } from "./persistent-run-log.js";

import {
  type ParserEvent,
  type ParserFilters,
} from "./parser-engine.js";

type Subscriber = (event: ParserEvent) => void;

type RunRecord = {
  id: string;
  events: ParserEvent[];
  subscribers: Set<Subscriber>;
  done: boolean;
  createdAt: number;
};

export class ActiveRunError extends Error {
  constructor() {
    super("Une extraction est déjà en cours. Veuillez attendre sa fin.");
    this.name = "ActiveRunError";
  }
}

type RunEngine<Filters extends ParserFilters> = {
  run(filters: Filters, emit: (event: ParserEvent) => void, batchRunId?: string): Promise<unknown>;
};

export type RunObserver<Filters extends ParserFilters> = {
  start(id: string, filters: Filters, trigger: Trigger): Promise<void>;
  event(id: string, event: ParserEvent): Promise<void>;
  finish(id: string, failed: boolean): Promise<void>;
};

export class RunManager<Filters extends ParserFilters = ParserFilters> {
  private readonly runs = new Map<string, RunRecord>();
  private activeRunId: string | null = null;

  constructor(
    private readonly engine: RunEngine<Filters>,
    private readonly observer?: RunObserver<Filters>,
  ) {}

  start(filters: Filters, trigger: Trigger = "MANUAL"): string {
    if (this.activeRunId) {
      throw new ActiveRunError();
    }

    const runId = randomUUID();
    const record: RunRecord = {
      id: runId,
      events: [],
      subscribers: new Set(),
      done: false,
      createdAt: Date.now(),
    };

    this.runs.set(runId, record);
    this.activeRunId = runId;
    this.prune();

    void this.execute(record, filters, trigger);

    return runId;
  }

  subscribe(
    runId: string,
    subscriber: Subscriber,
  ): {
    events: ParserEvent[];
    done: boolean;
    unsubscribe: () => void;
  } | null {
    const record = this.runs.get(runId);

    if (!record) {
      return null;
    }

    record.subscribers.add(subscriber);

    return {
      events: [...record.events],
      done: record.done,
      unsubscribe: () => record.subscribers.delete(subscriber),
    };
  }

  private async execute(
    record: RunRecord,
    filters: Filters,
    trigger: Trigger,
  ): Promise<void> {
    let failed = false;
    let pending: Promise<void> = Promise.resolve();
    const persist = (event: ParserEvent) => {
      // Serialized writes keep events in the same order as the live SSE stream.
      pending = pending.then(async () => {
        await this.observer?.event(record.id, event);
      }).catch((error: unknown) => {
        console.error("Parser monitoring event persistence failed:", error);
      });
    };
    try {
      if (this.observer) await this.observer.start(record.id, filters, trigger);
      await this.engine.run(filters, (event) => {
        this.emit(record, event);
        persist(event);
        if (event.type === "run-error") failed = true;
      }, record.id);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      const event: ParserEvent = {
        type: "run-error", timestamp: new Date().toISOString(),
        message: "Échec de l’extraction — " + message,
      };
      this.emit(record, event);
      // If the batch could not be created, writing an event would violate its FK.
      if (this.observer) persist(event);
    } finally {
      await pending;
      if (this.observer) {
        try { await this.observer.finish(record.id, failed); }
        catch (error) { console.error("Parser monitoring completion failed:", error); }
      }
      record.done = true;
      if (this.activeRunId === record.id) this.activeRunId = null;
    }
  }

  private emit(record: RunRecord, event: ParserEvent): void {
    record.events.push(event);

    for (const subscriber of record.subscribers) {
      subscriber(event);
    }
  }

  private prune(): void {
    const completed = [...this.runs.values()]
      .filter((run) => run.done)
      .sort((a, b) => a.createdAt - b.createdAt);

    while (this.runs.size > 20 && completed.length > 0) {
      const oldest = completed.shift();

      if (oldest) {
        this.runs.delete(oldest.id);
      }
    }
  }
}
