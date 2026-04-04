import type Dockerode from "dockerode";
import { getDockerClient } from "./client.js";

/**
 * Lists containers. Pass `all: true` to include stopped containers.
 */
export async function listContainers(opts?: {
  all?: boolean;
  filters?: Record<string, string[]>;
}): Promise<Dockerode.ContainerInfo[]> {
  const docker = getDockerClient();
  return docker.listContainers({
    all: opts?.all,
    filters: opts?.filters,
  });
}

/**
 * Starts a container by ID.
 */
export async function startContainer(id: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(id);
  await container.start();
}

/**
 * Stops a container by ID.
 */
export async function stopContainer(id: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(id);
  await container.stop();
}

/**
 * Restarts a container by ID.
 */
export async function restartContainer(id: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(id);
  await container.restart();
}

/**
 * Removes a container by ID. Pass `force: true` to force-remove a running container.
 */
export async function removeContainer(
  id: string,
  opts?: { force?: boolean }
): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(id);
  await container.remove({ force: opts?.force });
}

/**
 * Returns container logs as a string.
 */
export async function getContainerLogs(
  id: string,
  opts?: { tail?: number; since?: number }
): Promise<string> {
  const docker = getDockerClient();
  const container = docker.getContainer(id);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail: opts?.tail,
    since: opts?.since,
  });
  return logs.toString();
}

/**
 * Executes a command inside a running container and returns stdout as a string.
 */
export async function execInContainer(
  id: string,
  cmd: string[]
): Promise<string> {
  const docker = getDockerClient();
  const container = docker.getContainer(id);

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ Detach: false, Tty: false });

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    stream.on("error", reject);
  });
}
