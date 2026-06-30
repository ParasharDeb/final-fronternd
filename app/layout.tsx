import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seer's Escape",
  description: "Outrun the goblin through the shrine woods.",
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
