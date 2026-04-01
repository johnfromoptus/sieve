"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TopBarProps {
  breadcrumb?: string;
  title?: string;
  rightContent?: ReactNode;
}

export default function TopBar({ breadcrumb, title, rightContent }: TopBarProps) {
  const router = useRouter();
  const [userInitial, setUserInitial] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) setUserInitial(email[0].toUpperCase());
    });
  }, []);

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
              <span className="text-zinc-400 text-sm shrink-0">{breadcrumb}</span>
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
            <button
              onClick={handleSignOut}
              className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 cursor-pointer hover:bg-zinc-600"
              aria-label="Sign out"
            >
              {userInitial}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
