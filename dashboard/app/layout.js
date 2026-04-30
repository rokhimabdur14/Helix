import { Geist, Orbitron } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
});

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "HELIX — AI Social Media Strategist by Akselera Tech",
  description: "The DNA of your brand, decoded.",
};

// Inline pre-hydration script: resolve theme dari localStorage + system pref
// dan set data-theme SEBELUM first paint. Tanpa ini ada flash dark→light atau
// sebaliknya (FOUC) saat user pakai light/system mode + reload.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('helix.theme');
    var pref = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var resolved = pref === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : pref;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${orbitron.variable} ${geist.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
