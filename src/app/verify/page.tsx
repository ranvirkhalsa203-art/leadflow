import AccountAction from "@/components/account-actions";
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <AccountAction mode="verify" token={token} />;
}
