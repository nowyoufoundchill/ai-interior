import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Interior Atelier",
  description: "A private virtual interior design studio for room intelligence, concepts, products, and renders."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
