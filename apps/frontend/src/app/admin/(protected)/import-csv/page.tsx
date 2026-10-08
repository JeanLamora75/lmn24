"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./import-csv.module.css";

const IMPORT_TYPES = [
  { value: "sources", label: "Sources" },
  { value: "feeds", label: "Flux RSS" },
  { value: "articles", label: "Articles" },
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
      kind: "danger" | "success" | "info";
      message: string;
    }
  | null;

type SourceAnalysis = {
  sourcesFound: number;
  newSources: number;
  errorSources: number;
  duplicates: number;
};

function isCsvFile(file: File): boolean {
  const hasCsvExtension = file.name.toLocaleLowerCase().endsWith(".csv");
  const hasAcceptedMime = CSV_MIME_TYPES.has(file.type.toLocaleLowerCase());

  return hasCsvExtension && hasAcceptedMime;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
    };

    if (Array.isArray(payload.message)) {
      return payload.message.join(" ");
    }

    return payload.message || fallback;
  } catch {
    return fallback;
  }
}

export default function ImportCsvPage() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [importType, setImportType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [analysis, setAnalysis] = useState<SourceAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  const resetAnalysis = () => {
    setAnalysis(null);
    setFeedback(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    resetAnalysis();
  };

  const validateSelection = (): File | null => {
    if (!importType) {
      setFeedback({
        kind: "danger",
        message: "Sélectionnez un type d’import.",
      });
      return null;
    }

    if (!selectedFile) {
      setFeedback({
        kind: "danger",
        message: "Sélectionnez un fichier CSV.",
      });
      return null;
    }

    if (!isCsvFile(selectedFile)) {
      setFeedback({
        kind: "danger",
        message: "Le fichier sélectionné doit être au format CSV.",
      });
      return null;
    }

    return selectedFile;
  };

  const analyzeFile = async () => {
    if (analyzing || importing) {
      return;
    }

    const file = validateSelection();

    if (!file) {
      return;
    }

    if (importType !== "sources") {
      setAnalysis(null);
      setFeedback({
        kind: "info",
        message:
          "Le fichier est prêt. Le traitement spécifique de ce type d’import sera réalisé dans une User Story dédiée.",
      });
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/admin/import-csv/sources/analyze",
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Le fichier CSV n’a pas pu être analysé.",
          ),
        );
      }

      const result = (await response.json()) as SourceAnalysis;
      setAnalysis(result);
      setFeedback({
        kind: "info",
        message:
          "Analyse terminée. Vérifiez le récapitulatif avant de charger les données en base.",
      });
    } catch (error) {
      setFeedback({
        kind: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Le fichier CSV n’a pas pu être analysé.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const importSources = async () => {
    if (!selectedFile || !analysis || importing || analyzing) {
      return;
    }

    setImporting(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        "/api/admin/import-csv/sources/import",
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "L’import des sources a échoué.",
          ),
        );
      }

      const result = (await response.json()) as {
        imported: number;
      };

      setFeedback({
        kind: "success",
        message:
          "Import terminé avec succès. " +
          result.imported +
          " source(s) ont été ajoutée(s).",
      });

      redirectTimer.current = setTimeout(() => {
        router.push("/admin");
      }, 5000);
    } catch (error) {
      setFeedback({
        kind: "danger",
        message:
          error instanceof Error
            ? error.message
            : "L’import des sources a échoué.",
      });
    } finally {
      setImporting(false);
    }
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
            disabled={analyzing || importing}
            onChange={(event) => {
              setImportType(event.target.value);
              resetAnalysis();
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
            disabled={analyzing || importing}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={analyzing || importing}
            onClick={() => void analyzeFile()}
          >
            {analyzing ? "Analyse…" : "Charger le fichier"}
          </button>
        </div>

        <div className="mt-3" id="csv-file-help">
          <p className="small text-body-secondary mb-1">
            Sélectionnez le type de données à mettre à jour puis choisissez le
            fichier CSV à importer.
          </p>
          <p className="small text-body-secondary mb-0">
            Pour les sources, l’en-tête attendu est :
            {" "}
            <code>name,slug,websiteUrl,country,isActive</code>.
          </p>
        </div>

        {feedback ? (
          <div
            id="csv-import-feedback"
            className={
              "alert mt-3 mb-0 " +
              (feedback.kind === "success"
                ? "alert-success"
                : feedback.kind === "info"
                  ? "alert-info"
                  : "alert-danger")
            }
            role={feedback.kind === "danger" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback.message}
          </div>
        ) : null}
      </section>

      {analysis ? (
        <section
          className="card border-0 shadow-sm mt-4"
          aria-labelledby="source-import-summary-title"
        >
          <div className="card-body p-4">
            <h2 className="h5 mb-3" id="source-import-summary-title">
              Résultat de l’analyse
            </h2>

            <dl className="row mb-4">
              <dt className="col-8 col-md-6">Sources trouvées</dt>
              <dd className="col-4 col-md-6 text-end text-md-start">
                {analysis.sourcesFound}
              </dd>

              <dt className="col-8 col-md-6">Nouvelles sources</dt>
              <dd className="col-4 col-md-6 text-end text-md-start">
                {analysis.newSources}
              </dd>

              <dt className="col-8 col-md-6">Sources en erreur</dt>
              <dd className="col-4 col-md-6 text-end text-md-start">
                {analysis.errorSources}
              </dd>

              <dt className="col-8 col-md-6">Doublons</dt>
              <dd className="col-4 col-md-6 text-end text-md-start">
                {analysis.duplicates}
              </dd>
            </dl>

            <div className="d-flex flex-column flex-sm-row gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing || analyzing}
                onClick={() => void importSources()}
              >
                {importing ? "Chargement…" : "Charger"}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={importing}
                onClick={() => window.location.reload()}
              >
                Annuler
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
