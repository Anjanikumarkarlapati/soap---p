import type { Metadata } from "next";
import { Archivo_Black, Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/store";

// Same families as the Figma template.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const archivo = Archivo_Black({ variable: "--font-archivo", weight: "400", subsets: ["latin"] });
const robotoMono = Roboto_Mono({ variable: "--font-roboto-mono", weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AcademiaX — Course Enrollment",
  description: "Course enrollment and tuition processing for AcademiaX Digital Learning",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} ${robotoMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
