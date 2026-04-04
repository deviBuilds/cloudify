"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/deployments": "Deployments",
  "/system": "System",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();

  const title =
    routeTitles[pathname] ??
    (pathname.startsWith("/deployments/") ? "Deployment" : "Cloudify");

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
