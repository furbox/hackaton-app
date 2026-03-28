import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { apiFetch } from "../api/client.ts";

interface ProfileUser {
  id: number;
  username: string;
  email?: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  rank?: string;
}

interface ProfileResponse {
  id?: number;
  username?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  rank?: string;
  rankId?: number;
  user?: ProfileUser;
  links?: ProfileLink[];
  favorites?: ProfileLink[];
  createdLinks?: ProfileLink[];
  favoriteLinks?: ProfileLink[];
  stats?: {
    totalLinks?: number;
    totalLikes?: number;
    totalViews?: number;
  };
}

interface ProfileLink {
  id: number;
  title: string;
  url: string;
  description?: string;
  short_code?: string;
  short_url?: string;
  og_image?: string;
  likes_count?: number;
  favorites_count?: number;
  views?: number;
  liked_by_me?: boolean;
  favorited_by_me?: boolean;
  username?: string;
  avatar_url?: string;
  owner_username?: string;
  owner_avatar_url?: string;
  user?: {
    username?: string;
    avatar_url?: string;
    avatarUrl?: string;
  };
  category?: { name: string; color: string } | null;
}

function readString(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function normalizeProfileUser(raw: unknown, fallbackUsername: string): ProfileUser {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    id: typeof source.id === "number" ? source.id : 0,
    username: readString(source, "username") ?? fallbackUsername,
    email: readString(source, "email"),
    avatar_url: readString(source, "avatar_url", "avatarUrl") ?? null,
    avatarUrl: readString(source, "avatarUrl", "avatar_url") ?? null,
    bio: readString(source, "bio") ?? null,
    rank: readString(source, "rank"),
  };
}

const RANK_BY_ID: Record<number, string> = {
  1: "Newbie",
  2: "Active",
  3: "Power User",
  4: "Legend",
  5: "GOD Mode",
};

function normalizeProfileLink(raw: unknown, owner: ProfileUser): ProfileLink | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const id = typeof source.id === "number" ? source.id : null;
  const title = readString(source, "title") ?? "Link";
  const url = readString(source, "url");

  if (id === null || !url) {
    return null;
  }

  const categoryRaw = source.category;
  const category =
    categoryRaw && typeof categoryRaw === "object"
      ? {
          name: readString(categoryRaw as Record<string, unknown>, "name") ?? "",
          color: readString(categoryRaw as Record<string, unknown>, "color") ?? "#6366f1",
        }
      : null;

  const userRaw = source.user;
  const userData =
    userRaw && typeof userRaw === "object"
      ? {
          username: readString(userRaw as Record<string, unknown>, "username"),
          avatar_url: readString(userRaw as Record<string, unknown>, "avatar_url"),
          avatarUrl: readString(userRaw as Record<string, unknown>, "avatarUrl"),
        }
      : undefined;

  const ownerUsername = readString(source, "owner_username", "ownerUsername") ?? owner.username;
  const ownerAvatar =
    readString(source, "owner_avatar_url", "ownerAvatarUrl")
    ?? readString(source, "avatar_url", "avatarUrl")
    ?? owner.avatar_url
    ?? owner.avatarUrl
    ?? undefined;

  return {
    id,
    title,
    url,
    description: readString(source, "description"),
    short_code: readString(source, "short_code", "shortCode"),
    short_url: readString(source, "short_url", "shortUrl"),
    og_image: readString(source, "og_image", "ogImage"),
    likes_count: typeof source.likes_count === "number"
      ? source.likes_count
      : typeof source.likesCount === "number"
        ? source.likesCount
        : 0,
    favorites_count: typeof source.favorites_count === "number"
      ? source.favorites_count
      : typeof source.favoritesCount === "number"
        ? source.favoritesCount
        : 0,
    views: typeof source.views === "number" ? source.views : 0,
    liked_by_me: typeof source.liked_by_me === "boolean"
      ? source.liked_by_me
      : typeof source.likedByMe === "boolean"
        ? source.likedByMe
        : false,
    favorited_by_me: typeof source.favorited_by_me === "boolean"
      ? source.favorited_by_me
      : typeof source.favoritedByMe === "boolean"
        ? source.favoritedByMe
        : false,
    username: readString(source, "username") ?? userData?.username ?? ownerUsername,
    avatar_url: ownerAvatar,
    owner_username: ownerUsername,
    owner_avatar_url: ownerAvatar,
    user: userData,
    category,
  };
}

export async function profileController(
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const { username } = params;

  const [user, profileResult] = await Promise.all([
    getSession(request),
    apiFetch<ProfileResponse>(`/api/users/${username}`, { method: "GET" }, request),
  ]);

  if (profileResult.status === 404 || !profileResult.data) {
    const errHtml = await renderPage("error", {
      data: {
        title: "Usuario no encontrado",
        status: 404,
        message: `El usuario "${username}" no existe.`,
        user,
      },
    });
    return new Response(errHtml.body, { status: 404, headers: errHtml.headers });
  }

  const profile = normalizeProfileUser(
    profileResult.data.user ?? (profileResult.data as unknown as ProfileUser),
    username
  );
  const profilePayload = profileResult.data;

  if (!profile.rank && typeof profilePayload.rankId === "number") {
    profile.rank = RANK_BY_ID[profilePayload.rankId] ?? undefined;
  }

  if (!profile.rank && typeof profilePayload.rank === "string") {
    profile.rank = profilePayload.rank;
  }

  const createdSource = profilePayload.createdLinks ?? profilePayload.links ?? [];
  const favoritesSource = profilePayload.favoriteLinks ?? profilePayload.favorites ?? [];

  const createdLinks: ProfileLink[] = createdSource
    .map((link) => normalizeProfileLink(link, profile))
    .filter((link): link is ProfileLink => link !== null);
  const favoriteLinks: ProfileLink[] = favoritesSource
    .map((link) => normalizeProfileLink(link, profile))
    .filter((link): link is ProfileLink => link !== null);
  const stats = profilePayload.stats ?? {
    totalLinks: profilePayload.totalLinks,
    totalLikes: profilePayload.totalLikes,
    totalViews: profilePayload.totalViews,
  };

  return renderPage("profile", {
    data: {
      title: profile.username ?? username,
      user,
      profile,
      createdLinks,
      favoriteLinks,
      stats,
    },
  });
}
