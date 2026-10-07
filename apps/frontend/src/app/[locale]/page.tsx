import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const tCategories = await getTranslations("categories");
  const tLanguages = await getTranslations("languages");

  return (
    <main className="container py-5">
      <h1 className="display-4 fw-semibold">LMN24</h1>
      <p className="lead mb-2">
        next-intl : {tCategories("news")}
      </p>
      <p className="text-body-secondary mb-0">
        {tLanguages("fr")} · {tLanguages("en")} · {tLanguages("de")}
      </p>
    </main>
  );
}
