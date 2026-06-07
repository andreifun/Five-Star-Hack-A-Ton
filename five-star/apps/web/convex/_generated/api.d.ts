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
import type * as ai_email from "../ai/email.js";
import type * as ai_env from "../ai/env.js";
import type * as ai_generateTips from "../ai/generateTips.js";
import type * as ai_research from "../ai/research.js";
import type * as ai_setupBusiness from "../ai/setupBusiness.js";
import type * as businessMetrics from "../businessMetrics.js";
import type * as businesses from "../businesses.js";
import type * as chatMessages from "../chatMessages.js";
import type * as chatThreads from "../chatThreads.js";
import type * as emailDrafts from "../emailDrafts.js";
import type * as helpers from "../helpers.js";
import type * as placesSearch from "../placesSearch.js";
import type * as products from "../products.js";
import type * as researchReports from "../researchReports.js";
import type * as reviews from "../reviews.js";
import type * as scraper from "../scraper.js";
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
  "ai/email": typeof ai_email;
  "ai/env": typeof ai_env;
  "ai/generateTips": typeof ai_generateTips;
  "ai/research": typeof ai_research;
  "ai/setupBusiness": typeof ai_setupBusiness;
  businessMetrics: typeof businessMetrics;
  businesses: typeof businesses;
  chatMessages: typeof chatMessages;
  chatThreads: typeof chatThreads;
  emailDrafts: typeof emailDrafts;
  helpers: typeof helpers;
  placesSearch: typeof placesSearch;
  products: typeof products;
  researchReports: typeof researchReports;
  reviews: typeof reviews;
  scraper: typeof scraper;
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
