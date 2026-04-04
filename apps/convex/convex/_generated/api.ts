/* eslint-disable */
/**
 * Stub generated API - replaced by actual codegen when Convex backend runs.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProxy = (): any =>
  new Proxy(
    {},
    {
      get: (_target, prop) =>
        new Proxy(
          {},
          {
            get: (_t, method) => `${String(prop)}.${String(method)}`,
          }
        ),
    }
  );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api: any = makeProxy();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const internal: any = makeProxy();
