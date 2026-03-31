import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { getFlash } from "../utils/flash.ts";
import path from "path";

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

  // Load video data from public/videos.json for SSR
  const videosPath = path.join(process.cwd(), "public", "videos.json");
  const videosFile = Bun.file(videosPath);
  const videosData = await videosFile.json();

  // Extract hero, mainVideo, and restVideos
  const hero = videosData.hero || { title: 'Cómo lo hice', description: '' };

  // Sort videos by id ascending
  const sortedVideos = (videosData.videos || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id);

  // First video is the main/featured video
  const mainVideo = sortedVideos[0] || null;

  // Rest of videos for the grid
  const restVideos = sortedVideos.slice(1);

  // Render page with video data
  return renderPage("behind-scenes", {
    data: {
      title: "Cómo lo hice",
      user,
      flash,
      hero,
      mainVideo,
      restVideos,
    },
  });
}
