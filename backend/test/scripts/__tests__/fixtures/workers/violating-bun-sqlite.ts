import { Database } from "bun:sqlite";
import { getDatabase } from "../../../../../db/connection.ts";

export function badWorker() {
  const db = getDatabase();
  return db;
}

export const dbRef = Database;
