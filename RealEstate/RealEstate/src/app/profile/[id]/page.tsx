import { ProfileView } from "@/components/profile-view";

interface SellerProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function SellerProfilePage({ params }: SellerProfilePageProps) {
  const { id } = await params;
  return <ProfileView profileId={id} />;
}
