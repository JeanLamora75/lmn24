import { FeedForm } from "../FeedForm";

type Props = Readonly<{
  searchParams: Promise<{ sourceId?: string }>;
}>;

export default async function NewFeedPage({ searchParams }: Props) {
  const { sourceId } = await searchParams;
  return <FeedForm mode="create" initialSourceId={sourceId?.slice(0, 255)} />;
}
