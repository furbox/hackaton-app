import { createLink } from "../../../services/links.service";

export async function handleLinksRoute(input: { url: string }) {
  return await createLink(input);
}
