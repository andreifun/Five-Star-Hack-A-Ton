/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentTodos from "../agentTodos.js";
import type * as ai_calculatePositivity from "../ai/calculatePositivity.js";
import type * as ai_chat from "../ai/chat.js";
import type * as ai_generateTips from "../ai/generateTips.js";
import type * as ai_setupBusiness from "../ai/setupBusiness.js";
import type * as businessMetrics from "../businessMetrics.js";
import type * as businesses from "../businesses.js";
import type * as placesSearch from "../placesSearch.js";
import type * as scraper from "../scraper.js";
import type * as chatMessages from "../chatMessages.js";
import type * as chatThreads from "../chatThreads.js";
import type * as helpers from "../helpers.js";
import type * as placesSearch from "../placesSearch.js";
import type * as products from "../products.js";
import type * as reviews from "../reviews.js";
import type * as setupTasks from "../setupTasks.js";
import type * as tips from "../tips.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentTodos: typeof agentTodos;
  "ai/calculatePositivity": typeof ai_calculatePositivity;
  "ai/chat": typeof ai_chat;
  "ai/generateTips": typeof ai_generateTips;
  "ai/setupBusiness": typeof ai_setupBusiness;
  businessMetrics: typeof businessMetrics;
  businesses: typeof businesses;
  placesSearch: typeof placesSearch;
  scraper: typeof scraper;
  chatMessages: typeof chatMessages;
  chatThreads: typeof chatThreads;
  helpers: typeof helpers;
  placesSearch: typeof placesSearch;
  products: typeof products;
  reviews: typeof reviews;
  setupTasks: typeof setupTasks;
  tips: typeof tips;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
