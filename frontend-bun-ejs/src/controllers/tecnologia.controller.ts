import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { getFlash } from "../utils/flash.ts";

export async function tecnologiaController(request: Request): Promise<Response> {
  const user = await getSession(request);
  const flash = getFlash(request);

  return renderPage("tecnologia", {
    data: {
      title: "Tecnologia",
      user,
      flash,
    },
  });
}
