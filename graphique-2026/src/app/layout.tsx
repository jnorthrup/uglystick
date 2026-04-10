import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientBody from "./ClientBody";

export const metadata: Metadata = {
  title: "GRAPHIQUE 2026 — Advanced Graph Visualization Engine",
  description:
    "A static-hosted, comprehensive graph visualization platform combining Mermaid and Graphviz DOT rendering with advanced yFiles-inspired layout algorithms and AI-powered diagnostics.",
  keywords: ["graph", "visualization", "mermaid", "graphviz", "diagrams", "layout", "AI"],
  authors: [{ name: "GRAPHIQUE Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0D1117",
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
      </head>
      <body suppressHydrationWarning className="antialiased">
        <ClientBody>{children}</ClientBody>
      </body>
    </html>
  );
}
