import type { Metadata } from "next";
import "./globals.css";
// The browser policy and script tags must use the nonce from the same request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "LeadFlow — From first hello to paid.",
  description:
    "A calm workspace for your clients, pipeline, follow-ups and revenue.",
  ...(process.env.APP_URL
    ? { metadataBase: new URL(process.env.APP_URL) }
    : {}),
  openGraph: {
    title: "LeadFlow — From first hello to paid.",
    description:
      "A calm workspace for your clients, pipeline, follow-ups and revenue.",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
