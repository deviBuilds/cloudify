/* eslint-disable */
/**
 * Generated `api` utility — patched for self-hosted Convex backend
 * that requires .js extensions in module paths.
 */

const fnName = Symbol.for("functionName");

function createApiWithJsExt(pathParts = []) {
  const handler = {
    get(_, prop) {
      if (typeof prop === "string") {
        return createApiWithJsExt([...pathParts, prop]);
      } else if (prop === fnName) {
        if (pathParts.length < 2) {
          const found = ["api", ...pathParts].join(".");
          throw new Error(
            `API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``
          );
        }
        const moduleParts = pathParts.slice(0, -1);
        const path = moduleParts.join("/") + ".js";
        const exportName = pathParts[pathParts.length - 1];
        if (exportName === "default") {
          return path;
        }
        return path + ":" + exportName;
      } else if (prop === Symbol.toStringTag) {
        return "FunctionReference";
      }
      return undefined;
    }
  };
  return new Proxy({}, handler);
}

export const api = createApiWithJsExt();
export const internal = createApiWithJsExt();
export const components = {};
