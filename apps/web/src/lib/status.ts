export const statusMap: Record<string, { color: string; label: string }> = {
  running: { color: "bg-green-500", label: "Running" },
  creating: { color: "bg-blue-400", label: "Creating" },
  stopped: { color: "bg-neutral-500", label: "Stopped" },
  error: { color: "bg-red-500", label: "Error" },
  degraded: { color: "bg-yellow-500", label: "Degraded" },
};

export function getStatusColor(status: string): string {
  return statusMap[status]?.color ?? "bg-neutral-500";
}
