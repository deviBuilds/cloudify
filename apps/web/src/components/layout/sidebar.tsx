"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FolderKanban,
  Container,
  Server,
  Settings,
  LogOut,
  Search,
  X,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Deployments", href: "/deployments", icon: Container },
  { title: "System", href: "/system", icon: Server },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { signOut } = useAuthActions();
  const projects = useQuery(api.projects.list);
  const deployments = useQuery(api.deployments.list);

  const [search, setSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "CL";

  const q = search.toLowerCase().trim();

  const filteredNav = q
    ? navItems.filter((item) => item.title.toLowerCase().includes(q))
    : [];

  const filteredProjects = q
    ? (projects ?? []).filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.domain.toLowerCase().includes(q)
      )
    : [];

  const filteredDeployments = q
    ? (deployments ?? []).filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.serviceType.toLowerCase().includes(q)
      )
    : [];

  const allResults = [
    ...filteredNav.map((item) => ({
      type: "page" as const,
      label: item.title,
      href: item.href,
      icon: item.icon,
    })),
    ...filteredProjects.map((p) => ({
      type: "project" as const,
      label: p.name,
      href: `/projects/${p._id}`,
      icon: FolderKanban,
    })),
    ...filteredDeployments.map((d) => ({
      type: "deployment" as const,
      label: d.name,
      href: `/deployments/${d._id}`,
      icon: Container,
    })),
  ];

  const handleOpen = () => {
    setIsSearchOpen(true);
    setSearch("");
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClose = () => {
    setIsSearchOpen(false);
    setSearch("");
    setSelectedIndex(0);
  };

  const handleNavigate = useCallback(
    (href: string) => {
      router.push(href);
      handleClose();
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault();
      handleNavigate(allResults[selectedIndex].href);
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "k"
      ) {
        e.preventDefault();
        if (isSearchOpen) {
          handleClose();
        } else {
          handleOpen();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSearchOpen]);

  return (
    <Sidebar>
      {/* Team Header */}
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

      {/* Search */}
      <div className="px-3 py-2">
        {isSearchOpen ? (
          <div className="relative">
            <div className="flex h-8 items-center gap-2 rounded-md border border-foreground/20 bg-sidebar-accent px-2.5 ring-1 ring-foreground/20">
              <Search className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="flex-1 bg-transparent text-xs text-sidebar-primary outline-none placeholder:text-sidebar-foreground/50"
              />
              <button
                onClick={handleClose}
                className="shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {q && (
              <div
                ref={resultsRef}
                className="absolute left-0 right-0 top-9 z-50 max-h-64 overflow-y-auto rounded-md border border-sidebar-border bg-sidebar p-1 shadow-lg"
              >
                {allResults.length > 0 ? (
                  <>
                    {filteredNav.length > 0 && (
                      <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                        Pages
                      </p>
                    )}
                    {allResults
                      .filter((r) => r.type === "page")
                      .map((result, i) => {
                        const globalIndex = allResults.indexOf(result);
                        return (
                          <button
                            key={result.href}
                            onClick={() => handleNavigate(result.href)}
                            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors ${
                              globalIndex === selectedIndex
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                            }`}
                          >
                            <result.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{result.label}</span>
                          </button>
                        );
                      })}
                    {filteredProjects.length > 0 && (
                      <p className="mt-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                        Projects
                      </p>
                    )}
                    {allResults
                      .filter((r) => r.type === "project")
                      .map((result) => {
                        const globalIndex = allResults.indexOf(result);
                        return (
                          <button
                            key={result.href}
                            onClick={() => handleNavigate(result.href)}
                            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors ${
                              globalIndex === selectedIndex
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                            }`}
                          >
                            <result.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{result.label}</span>
                          </button>
                        );
                      })}
                    {filteredDeployments.length > 0 && (
                      <p className="mt-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                        Deployments
                      </p>
                    )}
                    {allResults
                      .filter((r) => r.type === "deployment")
                      .map((result) => {
                        const globalIndex = allResults.indexOf(result);
                        return (
                          <button
                            key={result.href}
                            onClick={() => handleNavigate(result.href)}
                            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors ${
                              globalIndex === selectedIndex
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                            }`}
                          >
                            <result.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{result.label}</span>
                          </button>
                        );
                      })}
                  </>
                ) : (
                  <p className="px-2 py-3 text-center text-xs text-sidebar-foreground/50">
                    No results found
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleOpen}
            className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border px-2.5 text-sidebar-foreground transition-colors hover:border-sidebar-foreground/20 hover:bg-sidebar-accent/50"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
            <span className="flex-1 text-left text-xs text-sidebar-foreground/50">
              Find...
            </span>
            <kbd className="rounded border border-sidebar-border px-1 text-[10px] text-sidebar-foreground/40">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <SidebarContent className="px-1.5 pt-0">
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

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-sidebar-accent text-[10px] font-medium text-sidebar-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-sidebar" />
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
