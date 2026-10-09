import { FeedForm } from "../../FeedForm";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function EditFeedPage({ params }: Props) {
  const { id } = await params;

  return <FeedForm mode="edit" feedId={id} />;
}
