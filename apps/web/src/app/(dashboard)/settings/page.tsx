"use client";

import { InfrastructureStatus } from "@/components/settings/infrastructure-status";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Settings</h3>
        <p className="text-xs text-muted-foreground">
          Platform configuration and infrastructure status
        </p>
      </div>
      <InfrastructureStatus />
    </div>
  );
}
