import { getLinkById } from "../../../../../db/queries/links.ts";

export function badWorker(linkId: number) {
  return getLinkById(linkId);
}
