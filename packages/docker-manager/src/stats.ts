import { getDockerClient } from "./client.js";

export interface ContainerStats {
  id: string;
  name: string;
  cpuPercent: number;
  memUsage: number;
  memLimit: number;
  netInput: number;
  netOutput: number;
}

/**
 * Fetches runtime stats for a container and returns a parsed summary.
 * CPU percentage is calculated from the Docker stats delta values.
 */
export async function getContainerStats(
  id: string
): Promise<ContainerStats> {
  const docker = getDockerClient();
  const container = docker.getContainer(id);
  const stats = (await container.stats({ stream: false })) as Record<string, any>;

  // CPU percentage calculation (delta approach)
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage -
    stats.precpu_stats.system_cpu_usage;
  const onlineCpus =
    stats.cpu_stats.online_cpus ?? stats.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;
  const cpuPercent =
    systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100.0 : 0;

  // Memory
  const memUsage = stats.memory_stats.usage ?? 0;
  const memLimit = stats.memory_stats.limit ?? 0;

  // Network I/O (aggregate across all interfaces)
  let netInput = 0;
  let netOutput = 0;
  if (stats.networks) {
    for (const iface of Object.values(stats.networks) as any[]) {
      netInput += iface.rx_bytes ?? 0;
      netOutput += iface.tx_bytes ?? 0;
    }
  }

  return {
    id: stats.id ?? id,
    name: stats.name?.replace(/^\//, "") ?? "",
    cpuPercent,
    memUsage,
    memLimit,
    netInput,
    netOutput,
  };
}
