"use client";

import { InfrastructureStatus } from "@/components/settings/infrastructure-status";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Platform configuration and infrastructure status
        </p>
      </div>
      <Separator />
      <InfrastructureStatus />
    </div>
  );
}
