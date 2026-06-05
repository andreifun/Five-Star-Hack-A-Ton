/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_chat from "../ai/chat.js";
import type * as ai_generateTips from "../ai/generateTips.js";
import type * as businessMetrics from "../businessMetrics.js";
import type * as businesses from "../businesses.js";
import type * as chatMessages from "../chatMessages.js";
import type * as chatThreads from "../chatThreads.js";
import type * as helpers from "../helpers.js";
import type * as products from "../products.js";
import type * as reviews from "../reviews.js";
import type * as tips from "../tips.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/chat": typeof ai_chat;
  "ai/generateTips": typeof ai_generateTips;
  businessMetrics: typeof businessMetrics;
  businesses: typeof businesses;
  chatMessages: typeof chatMessages;
  chatThreads: typeof chatThreads;
  helpers: typeof helpers;
  products: typeof products;
  reviews: typeof reviews;
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
