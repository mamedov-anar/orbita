import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["cyrillic", "latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["cyrillic", "latin"] });
const origin = process.env.PAGES_ORIGIN ?? "https://mamedov-anar.github.io";
const basePath = process.env.PAGES_BASE_PATH ?? "/orbita";
const title = "ОРБИТА — Солнечная система сейчас";
const description = "Интерактивная карта планет с приближением и положением Луны по выбранному времени.";
const previewImage = `${origin}${basePath}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(`${origin}${basePath}/`),
  title,
  description,
  openGraph: {
    title, description, type: "website",
    url: `${origin}${basePath}/`,
    images: [{ url: previewImage, width: 1728, height: 920, alt: "ОРБИТА — Земля, Луна и Солнечная система сейчас" }],
  },
  twitter: { card: "summary_large_image", title, description, images: [previewImage] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
