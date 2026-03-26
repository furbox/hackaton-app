import { verifyApiKey as serviceVerifyApiKey } from "../services/api-keys.service.ts";
import {
  extractSkillLinkById as serviceExtractSkillLinkById,
  lookupSkillLinkByUrl as serviceLookupSkillLinkByUrl,
  type SkillExtractActor,
  type SkillLinkMetadata,
} from "../services/skill-extract.service.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../contracts/service-error.ts";
import type { ApiKeyAuthContext } from "../contracts/api-keys.ts";

export type { SkillLinkMetadata } from "../services/skill-extract.service.ts";

export interface SkillExtractRouteDeps {
  verifyApiKey: (key: string) => Promise<Phase4ServiceResult<ApiKeyAuthContext>>;
  extractSkillLinkById: (actor: SkillExtractActor, id: number) => Phase4ServiceResult<SkillLinkMetadata>;
  lookupSkillLinkByUrl: (actor: SkillExtractActor, url: string) => Phase4ServiceResult<SkillLinkMetadata>;
}

function defaultDeps(): SkillExtractRouteDeps {
  return {
    verifyApiKey: serviceVerifyApiKey,
    extractSkillLinkById: serviceExtractSkillLinkById,
    lookupSkillLinkByUrl: serviceLookupSkillLinkByUrl,
  };
}

function validationError(message: string): Response {
  return Response.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    },
    { status: 400 }
  );
}

function unauthorizedError(message: string): Response {
  return Response.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message,
      },
    },
    { status: 401 }
  );
}

function responseFromService<T>(result: Phase4ServiceResult<T>): Response {
  if (!result.ok) {
    const mapped = mapPhase4ServiceError(result.error);
    return Response.json(mapped.body, { status: mapped.status });
  }

  return Response.json({ data: result.data }, { status: 200 });
}

function parseBearerApiKey(request: Request): { key: string | null; malformed: boolean } {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return { key: null, malformed: false };
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { key: null, malformed: true };
  }

  const candidate = match[1].trim();
  if (!candidate) {
    return { key: null, malformed: true };
  }

  return { key: candidate, malformed: false };
}

function parseExtractId(path: string): number | null {
  const match = path.match(/^\/api\/skill\/extract\/(\d+)$/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

export async function handleSkillExtractRoute(
  request: Request,
  path: string,
  deps?: Partial<SkillExtractRouteDeps>
): Promise<Response | null> {
  const isExtractPath = path.startsWith("/api/skill/extract/");
  const isLookupPath = path === "/api/skill/lookup";

  if (!isExtractPath && !isLookupPath) {
    return null;
  }

  if (request.method.toUpperCase() !== "GET") {
    return Response.json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Method not allowed",
        },
      },
      { status: 405 }
    );
  }

  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  const auth = parseBearerApiKey(request);
  if (auth.malformed) {
    return unauthorizedError("Invalid Authorization header");
  }

  let actor: SkillExtractActor = null;
  if (auth.key) {
    const authResult = await resolvedDeps.verifyApiKey(auth.key);
    if (!authResult.ok) {
      return unauthorizedError("Invalid API key");
    }

    actor = { userId: authResult.data.user_id };
  }

  if (isExtractPath) {
    const id = parseExtractId(path);
    if (id === null) {
      return validationError("id must be a positive integer");
    }

    return responseFromService(resolvedDeps.extractSkillLinkById(actor, id));
  }

  const url = new URL(request.url);
  const rawUrl = url.searchParams.get("url") ?? "";

  return responseFromService(resolvedDeps.lookupSkillLinkByUrl(actor, rawUrl));
}
