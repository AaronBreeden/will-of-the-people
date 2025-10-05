import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StickyNav from "@/components/StickyNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Will of the People",
  description: "Democratic voting platform for informed citizen participation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Global Navigation */}
        <StickyNav />

        {/* Main Content */}
        <main className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                {/* Just the logo + copyright */}
                <span className="text-sm text-gray-600">
                  © 2025 The Will of the People
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Empowering informed democratic participation
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}