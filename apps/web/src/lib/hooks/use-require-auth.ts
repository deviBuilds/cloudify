"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConvexAuth } from "convex/react";

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}
