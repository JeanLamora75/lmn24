import { HashtagForm } from "../../HashtagForm";
type Props = Readonly<{ params: Promise<{ id: string }> }>;
export default async function EditHashtagPage({ params }: Props) {
  const { id } = await params;
  return <HashtagForm mode="edit" hashtagId={id} />;
}
