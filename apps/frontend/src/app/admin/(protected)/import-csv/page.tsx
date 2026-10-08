import Link from "next/link";

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

export default function ImportCsvPage() {
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
            defaultValue=""
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

        <div className="alert alert-info mb-4" role="note">
          Sélectionnez le type de données à mettre à jour puis choisissez le
          fichier CSV à importer. Les contrôles et règles d’import dépendent du
          type de données sélectionné.
        </div>

        <div>
          <label className="form-label" htmlFor="csv-file">
            Pièce jointe
          </label>
          <input
            id="csv-file"
            name="csvFile"
            type="file"
            className="form-control"
            accept=".csv,text/csv"
            aria-describedby="csv-file-help"
          />
          <div className="form-text" id="csv-file-help">
            Format accepté : fichier CSV (.csv).
          </div>
        </div>
      </section>
    </main>
  );
}
