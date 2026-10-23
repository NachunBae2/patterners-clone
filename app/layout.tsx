import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/app/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "패터너스 | PATTERNERS",
  description: "코바늘·대바늘 도안을 웹에서 그리는 패터너스. 기호 배치, 차트 편집, 페이퍼까지 한곳에서 완성하세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
