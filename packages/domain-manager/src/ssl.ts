import type { NginxProxyManager } from "./nginx-proxy.js";

export async function discoverWildcardCert(
  npmClient: NginxProxyManager,
  wildcardDomain: string,
): Promise<number | null> {
  const certId = await npmClient.findWildcardCert(wildcardDomain);

  if (certId !== null) {
    console.log(
      `[ssl] Found wildcard certificate for *.${wildcardDomain} (id: ${certId})`,
    );
  } else {
    console.log(
      `[ssl] No wildcard certificate found for *.${wildcardDomain}`,
    );
  }

  return certId;
}
