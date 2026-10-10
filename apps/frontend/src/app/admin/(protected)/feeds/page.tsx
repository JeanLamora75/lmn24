import { FeedsTable } from "./FeedsTable";

type Props = {
  searchParams: Promise<{ sourceId?: string; sourceName?: string }>;
};

export default async function AdminFeedsPage({ searchParams }: Props) {
  const { sourceId, sourceName } = await searchParams;
  const validSourceId = sourceId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(sourceId)
    ? sourceId
    : "";
  return (
    <FeedsTable
      initialSourceId={validSourceId}
      initialSourceName={validSourceId ? (sourceName ?? "").slice(0, 255) : ""}
    />
  );
}
