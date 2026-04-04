import type { Metadata } from "next"

import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const appName = "AutoReceipt"
const appDescription =
  "Upload receipts, extract key details automatically, and review expenses faster."

export const metadata: Metadata = {
  metadataBase: new URL("https://autoreceipt.app"),
  title: {
    default: `${appName} | AI Receipt Processing`,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  applicationName: appName,
  keywords: [
    "receipt scanner",
    "expense tracking",
    "receipt extraction",
    "AI receipts",
    "bookkeeping",
    "expense insights",
  ],
  openGraph: {
    title: `${appName} | AI Receipt Processing`,
    description: appDescription,
    siteName: appName,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${appName} | AI Receipt Processing`,
    description: appDescription,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased font-sans")}
    >
      <body>
        <ThemeProvider>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
