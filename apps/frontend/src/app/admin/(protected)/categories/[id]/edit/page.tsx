import { CategoryAppearanceForm } from "../../CategoryAppearanceForm";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;

  return <CategoryAppearanceForm categoryId={id} />;
}
