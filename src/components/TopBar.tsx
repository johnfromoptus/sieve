"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TopBarProps {
  breadcrumb?: string;
  breadcrumbHref?: string;
  title?: string;
  rightContent?: ReactNode;
}

export default function TopBar({ breadcrumb, breadcrumbHref, title, rightContent }: TopBarProps) {
  const router = useRouter();
  const [userInitial, setUserInitial] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) setUserInitial(email[0].toUpperCase());
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 w-full bg-zinc-900 border-b border-zinc-800 z-50 h-14">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-full">
        {/* Left section */}
        <div className="flex items-center min-w-0">
          <Link href="/dashboard" className="text-xl font-bold text-white tracking-tight shrink-0">
            sieve
          </Link>
          {breadcrumb && (
            <>
              <span className="text-zinc-600 mx-2">/</span>
              {breadcrumbHref ? (
                <Link href={breadcrumbHref} className="text-zinc-400 text-sm shrink-0 hover:text-zinc-200 transition-colors">
                  {breadcrumb}
                </Link>
              ) : (
                <span className="text-zinc-400 text-sm shrink-0">{breadcrumb}</span>
              )}
            </>
          )}
          {breadcrumb && title && (
            <>
              <span className="text-zinc-600 mx-2">›</span>
              <span className="text-white text-sm font-medium truncate max-w-xs">{title}</span>
            </>
          )}
        </div>

        {/* Right section */}
        <div className="flex flex-row gap-3 items-center shrink-0">
          {rightContent}
          {userInitial && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 cursor-pointer hover:bg-zinc-600"
              >
                {userInitial}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 w-36 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl z-50">
                  <button
                    onClick={handleSignOut}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
