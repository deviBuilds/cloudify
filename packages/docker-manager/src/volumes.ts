import { getDockerClient } from "./client.js";

/**
 * Lists all Docker volumes.
 */
export async function listVolumes() {
  const docker = getDockerClient();
  return docker.listVolumes();
}

/**
 * Removes a Docker volume by name.
 */
export async function removeVolume(name: string): Promise<void> {
  const docker = getDockerClient();
  const volume = docker.getVolume(name);
  await volume.remove();
}
