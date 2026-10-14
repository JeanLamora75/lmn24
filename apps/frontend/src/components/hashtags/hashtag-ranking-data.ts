export type RankingPeriod = "24h" | "7d" | "30d";
export type RankingMode = "most-cited" | "trending";
export type RankingParams = {
  period: RankingPeriod;
  mode: RankingMode;
  page: number;
};

export type RankingItem = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  mentions: number;
  previousMentions: number | null;
  changePercent: number | null;
  changeLabel: string;
  trendScore: number | null;
};
export type RankingPage = {
  period: RankingPeriod;
  mode: RankingMode;
  asOf: string;
  calculatedAt: string;
  freshness: "fresh" | "stale" | "unverified";
  comparisonAvailable: boolean;
  comparisonReason: string | null;
  lastFullRebuildAt: string | null;
  coverageSinceUtc: string | null;
  items: RankingItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type HashtagLabels = {
  title: string; description: string; mostCited: string; trending: string;
  periods: Record<RankingPeriod, string>; mentions: string; mentionsShort: string;
  variation: string; updated: string; calculated: string; allLanguages: string;
  empty: string; noTrending: string; insufficientHistory: string; stale: string;
  unverified: string; fresh: string; unavailable: string; retry: string;
  previous: string; next: string; page: string; of: string; new: string;
  detailsPending: string; back: string; topic: string;
};

const fr: HashtagLabels = {
  title: "Hashtags", description: "Les sujets les plus cités et les tendances de l'actualité mondiale",
  mostCited: "Plus cités", trending: "Tendances",
  periods: { "24h": "24 heures", "7d": "7 jours", "30d": "30 jours" },
  mentions: "articles", mentionsShort: "articles", variation: "Évolution",
  updated: "Heure de référence", calculated: "Classement calculé",
  allLanguages: "Actualités de toutes les langues",
  empty: "Aucun hashtag cité sur cette période.",
  noTrending: "Aucune tendance ne satisfait les seuils de détection pour cette période.",
  insufficientHistory: "La comparaison de cette période n'est pas encore fiable : historique insuffisant ou recalcul complet nécessaire.",
  stale: "Statistiques en attente d'une reconstruction récente",
  unverified: "Historique non encore vérifié", fresh: "Statistiques vérifiées",
  unavailable: "Classement temporairement indisponible.",
  retry: "Réessayer", previous: "Précédent", next: "Suivant",
  page: "Page", of: "sur", new: "Nouveau", detailsPending: "Les articles liés à ce sujet seront disponibles prochainement.",
  back: "Retour aux hashtags", topic: "Sujet",
};
const en: HashtagLabels = {
  title: "Hashtags", description: "Most mentioned topics and trends in world news",
  mostCited: "Most cited", trending: "Trending",
  periods: { "24h": "24 hours", "7d": "7 days", "30d": "30 days" },
  mentions: "articles", mentionsShort: "articles", variation: "Change",
  updated: "Data through", calculated: "Ranking calculated", allLanguages: "News in all languages",
  empty: "No hashtags mentioned in this period.",
  noTrending: "No trends meet the detection thresholds for this period.",
  insufficientHistory: "This period cannot be compared reliably yet: insufficient history or a complete rebuild is needed.",
  stale: "Statistics awaiting a recent rebuild", unverified: "History not yet verified",
  fresh: "Statistics verified", unavailable: "Ranking temporarily unavailable.",
  retry: "Retry", previous: "Previous", next: "Next", page: "Page", of: "of", new: "New",
  detailsPending: "Related articles will be available soon.", back: "Back to hashtags", topic: "Topic",
};
const de: HashtagLabels = {
  ...en, description: "Häufigste Themen und Trends in den Weltnachrichten",
  mostCited: "Meistgenannt", trending: "Trends",
  periods: { "24h": "24 Stunden", "7d": "7 Tage", "30d": "30 Tage" },
  mentions: "Artikel", mentionsShort: "Artikel", variation: "Veränderung",
  updated: "Datenstand", calculated: "Berechnet", allLanguages: "Nachrichten in allen Sprachen",
  empty: "Keine Erwähnungen in diesem Zeitraum.", noTrending: "Keine Trends erfüllen die Schwellenwerte.",
  insufficientHistory: "Für diesen Zeitraum fehlt ein vollständiger Vergleichszeitraum.",
  unavailable: "Rangliste vorübergehend nicht verfügbar.",
  previous: "Zurück", next: "Weiter", page: "Seite", of: "von", new: "Neu",
  detailsPending: "Zugehörige Artikel folgen in Kürze.", back: "Zurück zu Hashtags",
};
const es: HashtagLabels = {
  ...en, description: "Temas más mencionados y tendencias de la actualidad mundial",
  mostCited: "Más citados", trending: "Tendencias",
  periods: { "24h": "24 horas", "7d": "7 días", "30d": "30 días" },
  mentions: "artículos", mentionsShort: "artículos", variation: "Variación",
  updated: "Datos hasta", calculated: "Clasificación calculada",
  allLanguages: "Noticias en todos los idiomas",
  empty: "No hay menciones en este período.", noTrending: "Ninguna tendencia cumple los umbrales.",
  insufficientHistory: "Aún no hay historial suficiente para una comparación fiable.",
  unavailable: "Clasificación temporalmente no disponible.",
  previous: "Anterior", next: "Siguiente", page: "Página", of: "de", new: "Nuevo",
  detailsPending: "Los artículos relacionados estarán disponibles próximamente.",
  back: "Volver a hashtags",
};
const pt: HashtagLabels = {
  ...en, description: "Temas mais citados e tendências das notícias mundiais",
  mostCited: "Mais citados", trending: "Tendências",
  periods: { "24h": "24 horas", "7d": "7 dias", "30d": "30 dias" },
  mentions: "artigos", mentionsShort: "artigos", variation: "Variação",
  updated: "Dados até", calculated: "Classificação calculada",
  allLanguages: "Notícias em todos os idiomas",
  empty: "Nenhuma menção neste período.", noTrending: "Nenhuma tendência cumpre os limites.",
  insufficientHistory: "Ainda não há histórico suficiente para uma comparação fiável.",
  unavailable: "Classificação temporariamente indisponível.",
  previous: "Anterior", next: "Seguinte", page: "Página", of: "de", new: "Novo",
  detailsPending: "Os artigos relacionados estarão disponíveis em breve.",
  back: "Voltar aos hashtags",
};
const it: HashtagLabels = {
  ...en, description: "Argomenti più citati e tendenze delle notizie dal mondo",
  mostCited: "Più citati", trending: "Tendenze",
  periods: { "24h": "24 ore", "7d": "7 giorni", "30d": "30 giorni" },
  mentions: "articoli", mentionsShort: "articoli", variation: "Variazione",
  updated: "Dati fino a", calculated: "Classifica calcolata",
  allLanguages: "Notizie in tutte le lingue",
  empty: "Nessuna menzione nel periodo.", noTrending: "Nessuna tendenza supera le soglie.",
  insufficientHistory: "Cronologia insufficiente per un confronto affidabile.",
  unavailable: "Classifica temporaneamente non disponibile.",
  previous: "Precedente", next: "Successiva", page: "Pagina", of: "di", new: "Nuovo",
  detailsPending: "Gli articoli relativi saranno disponibili a breve.",
  back: "Torna agli hashtag",
};
const ru: HashtagLabels = {
  ...en, description: "Самые упоминаемые темы и тенденции мировых новостей",
  mostCited: "Часто упоминаемые", trending: "Тренды",
  periods: { "24h": "24 часа", "7d": "7 дней", "30d": "30 дней" },
  mentions: "статей", mentionsShort: "статей", variation: "Изменение",
  updated: "Данные до", calculated: "Рейтинг рассчитан",
  allLanguages: "Новости на всех языках",
  empty: "Упоминаний за период нет.", noTrending: "Тренды не достигли порогов.",
  insufficientHistory: "Недостаточно данных для достоверного сравнения.",
  unavailable: "Рейтинг временно недоступен.",
  previous: "Назад", next: "Далее", page: "Страница", of: "из", new: "Новый",
  detailsPending: "Статьи по этой теме появятся позже.", back: "Назад к хэштегам",
};
const nl: HashtagLabels = {
  ...en, description: "Meest genoemde onderwerpen en trends in het wereldnieuws",
  mostCited: "Meest genoemd", trending: "Trends",
  periods: { "24h": "24 uur", "7d": "7 dagen", "30d": "30 dagen" },
  mentions: "artikelen", mentionsShort: "artikelen", variation: "Verandering",
  updated: "Gegevens tot", calculated: "Ranglijst berekend",
  allLanguages: "Nieuws in alle talen",
  empty: "Geen vermeldingen in deze periode.", noTrending: "Geen trends boven de drempelwaarden.",
  insufficientHistory: "Onvoldoende geschiedenis voor een betrouwbare vergelijking.",
  unavailable: "Ranglijst tijdelijk niet beschikbaar.",
  previous: "Vorige", next: "Volgende", page: "Pagina", of: "van", new: "Nieuw",
  detailsPending: "Bijbehorende artikelen komen binnenkort beschikbaar.",
  back: "Terug naar hashtags",
};

export const HASHTAG_LABELS = { fr, en, de, es, pt, it, ru, nl } as const;

export function getHashtagLabels(locale: string): HashtagLabels {
  return HASHTAG_LABELS[locale as keyof typeof HASHTAG_LABELS] ?? fr;
}
export function parseRankingParams(raw: Record<string, string | string[] | undefined>): RankingParams {
  const scalar = (key: string): string | undefined =>
    typeof raw[key] === "string" ? raw[key] : undefined;
  const period = scalar("period");
  const mode = scalar("mode");
  const pageText = scalar("page");
  const page = pageText && /^\d{1,6}$/.test(pageText) ? Number(pageText) : 1;
  return {
    period: period === "7d" || period === "30d" ? period : "24h",
    mode: mode === "trending" ? mode : "most-cited",
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}
export function hashtagRankingHref(locale: string, options: RankingParams): string {
  const params = new URLSearchParams({ period: options.period, mode: options.mode });
  if (options.page > 1) params.set("page", String(options.page));
  return "/" + locale + "/hashtags?" + params.toString();
}
export function safeHashtagImage(imageUrl: string | null): string | null {
  return imageUrl && /^\/api\/media\/hashtags\/[a-f0-9-]{36}\.webp$/i.test(imageUrl)
    ? imageUrl : null;
}
