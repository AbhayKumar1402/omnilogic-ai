import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniLogic - Universal Problem-Solver",
  description: "A premium AI orchestration platform for deep processing and universal problem solving.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col relative">
        <div className="gemini-glow"></div>
        {children}
      </body>
    </html>
  );
}
