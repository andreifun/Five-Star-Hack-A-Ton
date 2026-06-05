/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

type Func = FunctionReference<any, any, any, any>;

interface ApiModules {
  users: {
    upsertCurrentUser: Func;
    getCurrentUser: Func;
  };
  businesses: {
    create: Func;
    update: Func;
    remove: Func;
    listByCurrentUser: Func;
    getById: Func;
  };
  reviews: {
    create: Func;
    bulkImport: Func;
    update: Func;
    listByBusiness: Func;
    searchByText: Func;
    remove: Func;
  };
  products: {
    create: Func;
    update: Func;
    remove: Func;
    listByBusiness: Func;
    reorder: Func;
  };
  tips: {
    updateStatus: Func;
    addNotes: Func;
    listByBusiness: Func;
    getById: Func;
  };
  businessMetrics: {
    getByBusiness: Func;
  };
  chatThreads: {
    create: Func;
    updateTitle: Func;
    archive: Func;
    listByBusiness: Func;
    getById: Func;
  };
  chatMessages: {
    listByThread: Func;
  };
  ai: {
    chat: { sendMessage: Func };
    generateTips: { generateTipsForBusiness: Func };
  };
}

interface InternalModules {
  tips: {
    create: Func;
  };
  businessMetrics: {
    recompute: Func;
  };
  chatMessages: {
    addMessage: Func;
    getRecentForContext: Func;
  };
  reviews: {
    bulkImport: Func;
  };
}

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: ApiModules;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: InternalModules;

export declare const components: {};
