import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Radar | Global Intelligence Dashboard",
  description: "Global social media intelligence dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
