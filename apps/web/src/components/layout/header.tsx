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
    (pathname.startsWith("/deployments/")
      ? "Deployment"
      : pathname.startsWith("/projects/")
        ? "Project"
        : "Cloudify");

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center border-b border-border bg-background px-4 md:px-6">
      <SidebarTrigger className="mr-3 lg:hidden" />
      <div className="flex-1" />
      <span className="text-sm font-medium text-foreground">{title}</span>
      <div className="flex-1" />
    </header>
  );
}
