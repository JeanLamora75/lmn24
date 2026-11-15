import "bootstrap/dist/css/bootstrap.min.css";
import "../globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | LMN24" },
  description: "Administration LMN24",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  icons: { icon: [{ url: "/logo_lmn24.png", type: "image/png", sizes: "192x192" }], shortcut: "/logo_lmn24.png", apple: "/logo_lmn24.png" },
};

type Props = Readonly<{
  children: ReactNode;
}>;

export default function AdminRootLayout({ children }: Props) {
  return (
    <html lang="fr">
      <body className="bg-body-tertiary">{children}</body>
    </html>
  );
}
