import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Brand typography: a high-contrast serif that speaks (Playfair Display,
// weight 400 + italics only) and a tracked-out light sans that whispers.
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-serif"
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "AI Interior Designer — Intelligent Spaces, Composed",
  description: "A private design studio. Begin with one photograph. Arrive at home."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
