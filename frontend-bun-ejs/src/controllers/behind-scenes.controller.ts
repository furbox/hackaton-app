import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { getFlash } from "../utils/flash.ts";

/**
 * Controller for the "Behind the Scenes" page.
 * Displays a collection of YouTube videos documenting the hackathon development process.
 *
 * Route: GET /como-lo-hice
 * Access: Public (no authentication required)
 */
export async function behindScenesController(
  request: Request
): Promise<Response> {
  // Get session user (optional - page is public)
  const user = await getSession(request);

  // Get flash messages (if any)
  const flash = getFlash(request);

  // Render page - video data is loaded client-side from /public/videos.json
  return renderPage("behind-scenes", {
    data: {
      title: "Cómo lo hice",
      user,
      flash,
    },
  });
}
