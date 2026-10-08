"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";

import styles from "./import-csv.module.css";

const IMPORT_TYPES = [
  {
    value: "sources",
    label: "Sources",
  },
  {
    value: "feeds",
    label: "Flux RSS",
  },
  {
    value: "articles",
    label: "Articles",
  },
] as const;

const CSV_MIME_TYPES = new Set([
  "",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

type Feedback =
  | {
      kind: "danger" | "success";
      message: string;
    }
  | null;

function isCsvFile(file: File): boolean {
  const hasCsvExtension = file.name.toLocaleLowerCase().endsWith(".csv");
  const hasAcceptedMime = CSV_MIME_TYPES.has(file.type.toLocaleLowerCase());

  return hasCsvExtension && hasAcceptedMime;
}

export default function ImportCsvPage() {
  const [importType, setImportType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    setFeedback(null);
  };

  const validateFile = () => {
    if (!importType) {
      setFeedback({
        kind: "danger",
        message: "Sélectionnez un type d’import.",
      });
      return;
    }

    if (!selectedFile) {
      setFeedback({
        kind: "danger",
        message: "Sélectionnez un fichier CSV.",
      });
      return;
    }

    if (!isCsvFile(selectedFile)) {
      setFeedback({
        kind: "danger",
        message: "Le fichier sélectionné doit être au format CSV.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      message:
        "Le type d’import et le fichier CSV sont valides. Le fichier est prêt pour le traitement.",
    });
  };

  return (
    <main className="container py-4 py-lg-5">
      <div className="mb-4">
        <Link href="/admin" className="btn btn-outline-secondary">
          Retour à l’administration
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="h2 mb-1">Import CSV</h1>
        <p className="text-body-secondary mb-0">
          Préparez l’import de données dans LMN24 à partir d’un fichier CSV.
        </p>
      </header>

      <div className="row mb-4">
        <div className="col-12 col-md-8 col-lg-6">
          <label className="form-label" htmlFor="csv-import-type">
            Type de données à mettre à jour
          </label>
          <select
            id="csv-import-type"
            name="importType"
            className="form-select"
            value={importType}
            onChange={(event) => {
              setImportType(event.target.value);
              setFeedback(null);
            }}
          >
            <option value="" disabled>
              Sélectionner un type d’import
            </option>

            {IMPORT_TYPES.map((type) => (
              <option value={type.value} key={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section
        className={"rounded-3 p-4 p-lg-5 " + styles.uploadPanel}
        aria-labelledby="csv-file-title"
      >
        <h2 className="h5 mb-3" id="csv-file-title">
          Fichier CSV
        </h2>

        <label className="form-label" htmlFor="csv-file">
          Pièce jointe
        </label>

        <div className="input-group">
          <input
            id="csv-file"
            name="csvFile"
            type="file"
            className="form-control"
            accept=".csv,text/csv"
            aria-describedby="csv-file-help csv-import-feedback"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={validateFile}
          >
            Charger le fichier
          </button>
        </div>

        <div className="mt-3" id="csv-file-help">
          <p className="small text-body-secondary mb-1">
            Sélectionnez le type de données à mettre à jour puis choisissez le
            fichier CSV à importer.
          </p>
          <p className="small text-body-secondary mb-0">
            Format accepté : fichier CSV (.csv). Les contrôles et règles
            d’import dépendent du type de données sélectionné.
          </p>
        </div>

        {feedback ? (
          <div
            id="csv-import-feedback"
            className={
              "alert mt-3 mb-0 " +
              (feedback.kind === "success"
                ? "alert-success"
                : "alert-danger")
            }
            role={feedback.kind === "danger" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback.message}
          </div>
        ) : null}
      </section>
    </main>
  );
}
