/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stub generated server utilities - replaced by actual codegen when Convex backend runs.
 */

type Handler = { args?: any; handler: (...args: any[]) => any; [key: string]: any };

export const query = <T extends Handler>(def: T): T => def;
export const mutation = <T extends Handler>(def: T): T => def;
export const action = <T extends Handler>(def: T): T => def;
export const internalQuery = <T extends Handler>(def: T): T => def;
export const internalMutation = <T extends Handler>(def: T): T => def;
export const internalAction = <T extends Handler>(def: T): T => def;
export const httpAction = (handler: any): any => handler;
