import Dockerode from "dockerode";

let instance: Dockerode | null = null;

/**
 * Returns a singleton Dockerode client connected via the local Docker socket.
 */
export function getDockerClient(): Dockerode {
  if (!instance) {
    instance = new Dockerode({ socketPath: "/var/run/docker.sock" });
  }
  return instance;
}

/**
 * Checks whether Docker is reachable by pinging the daemon.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const client = getDockerClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
