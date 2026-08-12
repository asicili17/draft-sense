import { AuthorizationError, requireSessionAccess } from "../auth";

export async function authorizeDraftChannels(channels: readonly string[]) {
  for (const channel of channels) {
    if (!channel.startsWith("draft:")) return new Response("Forbidden", { status: 403 });
    const sessionId = channel.slice("draft:".length);
    try {
      const { session } = await requireSessionAccess(sessionId);
      if (!session) return new Response("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof AuthorizationError && error.code === "UNAUTHENTICATED")
        return new Response("Unauthorized", { status: 401 });
      return new Response("Forbidden", { status: 403 });
    }
  }
}
