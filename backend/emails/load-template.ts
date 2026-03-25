/**
 * Email Template Loader — Phase 3.7
 *
 * Shared Bun-native template loader for transactional emails.
 * Reads HTML templates from disk and performs safe placeholder interpolation.
 *
 * ## Design
 *
 * - Templates are stored as `.html` files in `backend/emails/templates/`
 * - Placeholders use `{{key}}` syntax
 * - Missing files return fallback HTML (non-blocking)
 * - Missing params are replaced with empty string + warning
 * - All values are HTML-escaped for safety
 *
 * @module backend/emails/load-template
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supported email template names.
 */
export type TemplateName = "verification" | "password-reset";

/**
 * Template parameter values.
 * Primitives are coerced to strings; null/undefined become empty strings.
 */
export type TemplateParams = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Error thrown when a template file cannot be loaded.
 */
export class TemplateFileError extends Error {
  constructor(templateName: TemplateName, cause?: unknown) {
    const message = `[email-template] Template file not found or unreadable: ${templateName}.html`;
    super(message);
    this.name = "TemplateFileError";
    this.cause = cause;
  }
}

/**
 * Error thrown when placeholder validation fails.
 */
export class TemplateParamError extends Error {
  constructor(
    templateName: TemplateName,
    public missingKeys: string[]
  ) {
    const message = `[email-template] Missing required placeholders for ${templateName}: ${missingKeys.join(", ")}`;
    super(message);
    this.name = "TemplateParamError";
  }
}

// ============================================================================
// INTERNAL UTILITIES
// ============================================================================

/**
 * Escapes HTML special characters to prevent injection.
 *
 * @param value - The value to escape
 * @returns HTML-safe string
 */
function escapeHtml(value: string | number | boolean): string {
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Extracts all {{placeholder}} keys from a template string.
 *
 * @param template - The HTML template content
 * @returns Array of placeholder keys (without the {{ }} braces)
 */
function extractPlaceholderKeys(template: string): string[] {
  const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const keys = new Set<string>();
  let match;

  while ((match = regex.exec(template)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys);
}

/**
 * Replaces {{placeholder}} tokens with provided values.
 *
 * @param template - The HTML template with {{key}} placeholders
 * @param params - Key-value pairs for substitution
 * @returns Template with all placeholders replaced
 */
function interpolatePlaceholders(
  template: string,
  params: Record<string, string>
): string {
  return template.replace(
    /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
    (_, key) => params[key] ?? ""
  );
}

/**
 * Returns minimal fallback HTML for when template files are missing.
 *
 * @param templateName - The name of the missing template
 * @returns Basic HTML with a button link
 */
function getFallbackHtml(templateName: TemplateName): string {
  if (templateName === "verification") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email — URLoft</title>
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; color: #111827;">
  <div style="background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #6366f1; margin-bottom: 16px;">Verify your email address</h1>
    <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
      Please click the button below to verify your email. This link expires in <strong>24 hours</strong>.
    </p>
    <a href="{{verification_url}}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
      Verify Email
    </a>
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      If you didn't create an account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
  }

  // password-reset fallback
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password — URLoft</title>
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; color: #111827;">
  <div style="background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #6366f1; margin-bottom: 16px;">Reset your password</h1>
    <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
      We received a request to reset your password. Click the button below. This link expires in <strong>1 hour</strong>.
    </p>
    <a href="{{reset_url}}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
      Reset Password
    </a>
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      If you didn't request this, ignore this email.
    </p>
  </div>
</body>
</html>`;
}

// ============================================================================
// TEMPLATE LOADER
// ============================================================================

/**
 * Loads an email template and interpolates placeholders.
 *
 * @param template - Name of the template to load
 * @param params - Key-value pairs for placeholder substitution
 * @returns Rendered HTML string
 *
 * @example
 * ```typescript
 * const html = await loadTemplate("verification", {
 *   verification_url: "https://urloft.site/api/auth/verify/abc123",
 *   base_url: "https://urloft.site"
 * });
 * ```
 */
export async function loadTemplate(
  template: TemplateName,
  params: TemplateParams
): Promise<string> {
  const templatePath = new URL(
    `../emails/templates/${template}.html`,
    import.meta.url
  );

  let htmlContent: string;

  try {
    const file = Bun.file(templatePath);
    htmlContent = await file.text();
  } catch (err) {
    console.warn(
      `[email-template] Failed to load template file: ${template}.html, using fallback`,
      err
    );
    htmlContent = getFallbackHtml(template);
  }

  // Extract all placeholder keys from the template
  const placeholderKeys = extractPlaceholderKeys(htmlContent);

  // Build params object with HTML-escaped values
  const escapedParams: Record<string, string> = {};
  const missingKeys: string[] = [];

  for (const key of placeholderKeys) {
    const rawValue = params[key];
    if (rawValue === null || rawValue === undefined) {
      missingKeys.push(key);
      escapedParams[key] = "";
    } else {
      escapedParams[key] = escapeHtml(rawValue);
    }
  }

  // Log warnings for missing params (non-blocking)
  if (missingKeys.length > 0) {
    console.warn(
      `[email-template] Missing placeholder values for ${template}: ${missingKeys.join(", ")}`
    );
  }

  // Interpolate placeholders
  return interpolatePlaceholders(htmlContent, escapedParams);
}
