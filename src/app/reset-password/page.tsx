import AccountAction from "@/components/account-actions";
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <AccountAction mode="reset" token={token} />;
}
