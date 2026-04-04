import { getDockerClient } from "./client.js";

/**
 * Lists all Docker networks.
 */
export async function listNetworks() {
  const docker = getDockerClient();
  return docker.listNetworks();
}

/**
 * Creates a Docker network with the given name.
 */
export async function createNetwork(name: string) {
  const docker = getDockerClient();
  return docker.createNetwork({ Name: name });
}

/**
 * Removes a Docker network by name.
 */
export async function removeNetwork(name: string): Promise<void> {
  const docker = getDockerClient();
  const network = docker.getNetwork(name);
  await network.remove();
}
