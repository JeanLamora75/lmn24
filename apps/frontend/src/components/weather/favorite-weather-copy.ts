import type { SupportedLocale } from "@lmn24/config";

export type FavoriteWeatherText = {
  badge: string; selected: string; returnToFavorite: string;
  loading: string; unavailable: string; retry: string;
};
export const FAVORITE_WEATHER_COPY: Record<SupportedLocale, FavoriteWeatherText> = {
  fr:{badge:"Ma ville",selected:"Ville favorite",returnToFavorite:"Revenir à ma ville",loading:"Chargement de la météo de ma ville…",unavailable:"Impossible de charger la météo de votre ville favorite.",retry:"Réessayer"},
  en:{badge:"My city",selected:"Favorite city",returnToFavorite:"Back to my city",loading:"Loading weather for my city…",unavailable:"Could not load your favorite city's weather.",retry:"Retry"},
  de:{badge:"Meine Stadt",selected:"Lieblingsstadt",returnToFavorite:"Zurück zu meiner Stadt",loading:"Wetter meiner Stadt wird geladen…",unavailable:"Wetter der Lieblingsstadt nicht verfügbar.",retry:"Erneut versuchen"},
  es:{badge:"Mi ciudad",selected:"Ciudad favorita",returnToFavorite:"Volver a mi ciudad",loading:"Cargando el tiempo de mi ciudad…",unavailable:"No se puede cargar el tiempo de tu ciudad favorita.",retry:"Reintentar"},
  pt:{badge:"A minha cidade",selected:"Cidade favorita",returnToFavorite:"Voltar à minha cidade",loading:"A carregar a meteorologia da minha cidade…",unavailable:"Não é possível obter a meteorologia da cidade favorita.",retry:"Tentar novamente"},
  it:{badge:"La mia città",selected:"Città preferita",returnToFavorite:"Torna alla mia città",loading:"Caricamento meteo della mia città…",unavailable:"Impossibile caricare il meteo della città preferita.",retry:"Riprova"},
  ru:{badge:"Мой город",selected:"Любимый город",returnToFavorite:"Вернуться к моему городу",loading:"Загружается погода моего города…",unavailable:"Не удалось загрузить погоду любимого города.",retry:"Повторить"},
  nl:{badge:"Mijn stad",selected:"Favoriete stad",returnToFavorite:"Terug naar mijn stad",loading:"Weer voor mijn stad laden…",unavailable:"Het weer voor je favoriete stad is niet beschikbaar.",retry:"Opnieuw proberen"},
};
export function favoriteWeatherCopy(locale: string): FavoriteWeatherText {
  return FAVORITE_WEATHER_COPY[locale as SupportedLocale] ?? FAVORITE_WEATHER_COPY.fr;
}
