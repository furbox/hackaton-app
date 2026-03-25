import { Database } from "bun:sqlite";
import { createLinkRecord } from "../../../db/queries/index.js";
import { getDatabase } from "../../../db/connection";

export function badRouteHandler() {
  const db = getDatabase();
  return createLinkRecord(db, {
    userId: 1,
    url: "https://example.com",
    title: "example",
  });
}

export const dbRef = Database;
