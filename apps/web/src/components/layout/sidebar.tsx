"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Container,
  Server,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Deployments", href: "/deployments", icon: Container },
  { title: "System", href: "/system", icon: Server },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { signOut } = useAuthActions();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "CL";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-gradient-to-br from-orange-400 to-pink-500 text-[10px] font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium text-sidebar-primary">
            {user?.email ?? "Cloudify"}
          </span>
          <Badge
            variant="outline"
            className="ml-auto h-[18px] shrink-0 border-sidebar-border px-1.5 text-[10px] font-normal text-sidebar-foreground"
          >
            Self-Hosted
          </Badge>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-sidebar-accent text-[10px] font-medium text-sidebar-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-black" />
          </div>
          <span className="flex-1 truncate text-xs text-sidebar-foreground">
            {user?.email ?? "User"}
          </span>
          <button
            onClick={() => signOut()}
            className="rounded p-1 text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
