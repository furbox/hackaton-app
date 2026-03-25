import { getDatabase } from "../../../../db/connection";
import { handleLinksRoute } from "../../../../routes/api/links";

export async function fetch(path: string, req: Request) {
  const db = getDatabase();
  if (path.startsWith("/api/links")) {
    const sql = "SELECT * FROM links";
    db.query(sql);
    return await handleLinksRoute(req, path);
  }

  return new Response("ok");
}
