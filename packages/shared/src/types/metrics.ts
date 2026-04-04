export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  uptime: number;
  loadAvg: number[];
}

export interface ContainerMetrics {
  id: string;
  name: string;
  cpuPercent: number;
  memUsage: number;
  memLimit: number;
  netInput: number;
  netOutput: number;
}
