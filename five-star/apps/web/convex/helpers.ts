import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

export async function requireCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error("User not found — call upsertCurrentUser first");
  return user;
}

export async function requireBusinessOwner(
  ctx: QueryCtx | MutationCtx,
  businessId: Id<"businesses">,
): Promise<{ user: Doc<"users">; business: Doc<"businesses"> }> {
  const user = await requireCurrentUser(ctx);
  const business = await ctx.db.get(businessId);
  if (!business || !business.isActive)
    throw new Error("Business not found");
  if (business.ownerId !== user._id) throw new Error("Forbidden");
  return { user, business };
}
