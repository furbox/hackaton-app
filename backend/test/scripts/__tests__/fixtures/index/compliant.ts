import { handleLinksRoute } from "../../../../routes/api/links";

export async function fetch(path: string, req: Request) {
  if (path.startsWith("/api/links")) {
    return await handleLinksRoute(req, path);
  }

  return new Response("ok");
}
