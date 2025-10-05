"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import Logo from "@/components/Logo";

const landingLinks = [
  { id: "mission", label: "Mission" },
  { id: "funding", label: "Funding" },
  { id: "how", label: "How It Works" },
  { id: "results", label: "Results" },
];

export default function StickyNav() {
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  const pathname = usePathname();
  const router = useRouter();

  // Get user + role
  useEffect(() => {
    async function getUserInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);

        const { data, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!error && data) {
          setRole(data.role);
        }
      }
    }
    getUserInfo();
  }, []);

  // Intersection observer for landing sections
  useEffect(() => {
    if (pathname !== "/") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );

    landingLinks.forEach((link) => {
      const section = document.getElementById(link.id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-mobile-menu]')) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push("/auth");
  };

  const closeMobileMenu = () => setMobileOpen(false);

  // Build nav links based on mode
  const renderLinks = (isMobile = false) => {
    const linkClass = isMobile 
      ? "block px-4 py-3 text-base font-medium border-b border-gray-100 transition-colors"
      : "block text-sm font-medium rounded px-2 py-1 transition-colors";

    if (pathname === "/") {
      return (
        <>
          {landingLinks.map((link) => (
            <Link
              key={link.id}
              href={`#${link.id}`}
              onClick={isMobile ? closeMobileMenu : undefined}
              className={clsx(
                linkClass,
                active === link.id
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-blue-500 hover:bg-gray-50"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth"
            onClick={isMobile ? closeMobileMenu : undefined}
            className={clsx(
              linkClass,
              "text-gray-600 hover:text-blue-500 hover:bg-gray-50"
            )}
          >
            Sign In
          </Link>
        </>
      );
    }

    return (
      <>
        <Link
          href="/dashboard"
          onClick={isMobile ? closeMobileMenu : undefined}
          className={clsx(
            linkClass,
            pathname === "/dashboard"
              ? "text-blue-600 bg-blue-50"
              : "text-gray-600 hover:text-blue-500 hover:bg-gray-50"
          )}
        >
          Dashboard
        </Link>

        <Link
          href="/results"
          onClick={isMobile ? closeMobileMenu : undefined}
          className={clsx(
            linkClass,
            pathname.startsWith("/results")
              ? "text-blue-600 bg-blue-50"
              : "text-gray-600 hover:text-blue-500 hover:bg-gray-50"
          )}
        >
          Results
        </Link>

        {role === "admin" && (
          <Link
            href="/admin"
            onClick={isMobile ? closeMobileMenu : undefined}
            className={clsx(
              linkClass,
              pathname.startsWith("/admin")
                ? "text-red-600 bg-red-50"
                : "text-red-500 hover:text-red-600 hover:bg-red-50"
            )}
          >
            Admin
          </Link>
        )}
      </>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur bg-white/90 border-b border-gray-200 shadow-sm">
        <nav className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* LEFT: Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Logo className="w-8 h-8 text-blue-900" />
            <span className="text-lg font-bold text-blue-900 hidden sm:inline">
              The Will of the People
            </span>
          </Link>

          {/* CENTER: Desktop Links */}
          <div className="hidden md:flex space-x-6">{renderLinks()}</div>

          {/* RIGHT: Profile / Auth */}
          <div className="hidden md:flex relative">
            {email ? (
              <>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="px-3 py-1.5 rounded border text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {email}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-50">
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </>
            ) : (
              pathname !== "/" && (
                <Link
                  href="/auth"
                  className="px-3 py-1.5 rounded border text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Sign In
                </Link>
              )
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 focus:outline-none transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-mobile-menu
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </nav>
      </header>

      {/* MOBILE OVERLAY */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          
          <div 
            className={clsx(
              "fixed top-0 right-0 h-full w-80 max-w-sm bg-white shadow-xl transform transition-transform duration-300 ease-in-out",
              mobileOpen ? "translate-x-0" : "translate-x-full"
            )}
            data-mobile-menu
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Logo className="w-6 h-6 text-blue-900" />
                <span className="text-sm font-bold text-blue-900">
                  The Will of the People
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-4">
              {renderLinks(true)}
              
              {email ? (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="px-4 py-2 text-sm text-gray-500">
                    Signed in as: <span className="font-medium text-gray-900">{email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                pathname !== "/" && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <Link
                      href="/auth"
                      onClick={closeMobileMenu}
                      className="block px-4 py-3 text-base font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Sign In
                    </Link>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}