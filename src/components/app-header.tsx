"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/photos", label: "Photos" },
  { href: "/settings", label: "Paramètres" },
  { href: "/export", label: "Export" },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  }

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold">Title4Pix</h1>
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label }) => (
          <Button
            key={href}
            variant="ghost"
            size="sm"
            onClick={() => router.push(href)}
            className={cn(
              pathname === href && "bg-accent text-accent-foreground"
            )}
          >
            {label}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={handleLogout} className="ml-2">
          Déconnexion
        </Button>
      </nav>
    </header>
  );
}
