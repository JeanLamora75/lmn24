import { randomUUID } from "node:crypto";

import {
  ParserEngine,
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

export class RunManager {
  private readonly runs = new Map<string, RunRecord>();
  private activeRunId: string | null = null;

  constructor(private readonly engine: ParserEngine) {}

  start(filters: ParserFilters): string {
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

    void this.execute(record, filters);

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
    filters: ParserFilters,
  ): Promise<void> {
    try {
      await this.engine.run(filters, (event) => {
        this.emit(record, event);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue.";

      this.emit(record, {
        type: "run-error",
        timestamp: new Date().toISOString(),
        message: "Échec de l’extraction — " + message,
      });
    } finally {
      record.done = true;

      if (this.activeRunId === record.id) {
        this.activeRunId = null;
      }
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
