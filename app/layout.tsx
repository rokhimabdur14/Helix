import { Orbitron, Space_Grotesk } from "next/font/google"
import "./globals.css"
import type { Metadata, Viewport } from "next"

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
})

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "HELIX — AI Social Media Strategist by Akselera Tech",
  description: "The DNA of your brand, decoded. AI-powered social media strategy that transforms your content into growth.",
}

export const viewport: Viewport = {
  themeColor: "#07050d",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${spaceGrotesk.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
