import frMessages from "../../../../messages/fr.json";

type CountryOption = Readonly<{
  isoCode2: string;
  label: string;
}>;

export const FRENCH_COUNTRY_OPTIONS: readonly CountryOption[] = Object.entries(
  frMessages.countries,
)
  .map(([isoCode2, label]) => ({
    isoCode2,
    label,
  }))
  .sort((a, b) =>
    a.label.localeCompare(b.label, "fr", {
      sensitivity: "base",
    }),
  );
