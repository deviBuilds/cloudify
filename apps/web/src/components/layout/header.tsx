"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/projects": "Projects",
  "/projects/new": "New Project",
  "/deployments": "Deployments",
  "/deployments/new": "New Deployment",
  "/system": "System",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();

  const title =
    routeTitles[pathname] ??
    (pathname.startsWith("/deployments/") ? "Deployment" :
     pathname.startsWith("/projects/") ? "Project" : "Cloudify");

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger className="lg:hidden" />
      <nav className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Cloudify</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-medium">{title}</span>
      </nav>
    </header>
  );
}
