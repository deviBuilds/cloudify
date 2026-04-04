import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

/**
 * Writes a docker-compose.yml (and optional .env) to the given directory.
 */
export function writeComposeFile(
  dir: string,
  composeObj: Record<string, unknown>,
  envVars?: Record<string, string>
): void {
  fs.mkdirSync(dir, { recursive: true });

  const composePath = path.join(dir, "docker-compose.yml");
  fs.writeFileSync(composePath, yaml.dump(composeObj), "utf-8");

  if (envVars) {
    const envPath = path.join(dir, ".env");
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    fs.writeFileSync(envPath, envContent + "\n", "utf-8");
  }
}

/**
 * Runs `docker compose up -d` in the given directory.
 */
export function composeUp(dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec("docker compose up -d", { cwd: dir }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`docker compose up failed: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Runs `docker compose down` in the given directory.
 * Pass `removeVolumes: true` to also remove volumes (-v flag).
 */
export function composeDown(
  dir: string,
  removeVolumes?: boolean
): Promise<void> {
  const flags = removeVolumes ? " -v" : "";
  return new Promise((resolve, reject) => {
    exec(`docker compose down${flags}`, { cwd: dir }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`docker compose down failed: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Runs `docker compose stop` in the given directory (stops without removing).
 */
export function composeStop(dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec("docker compose stop", { cwd: dir }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`docker compose stop failed: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Runs `docker compose restart` in the given directory.
 */
export function composeRestart(dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec("docker compose restart", { cwd: dir }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`docker compose restart failed: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}
