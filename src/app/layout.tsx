import type { Metadata } from "next";

import "./globals.css";
export const metadata: Metadata = {
  title: "Emerald Isle Travels CRM",
  robots: { index: false, follow: false },
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
