/**
 * Perimeter defense rules for blocking scanning probes, sensitive file extensions,
 * and dangerous directory traversals before static asset lookups.
 */

// Block sensitive file extension probes commonly targeted by scanners
export const SENSITIVE_EXTENSIONS_REGEX =
  /\.(env|git|bak|old|save|php|axd|properties|sql|ini|sh|action|application|yaml|yml|conf|config|key|pem|crt|log)$/i;

// Block sensitive path and probe basenames commonly targeted by scanners
export const SENSITIVE_PROBES_REGEX =
  /(?:\/|^|[-_.])(?:dockerfile|credentials|secrets?|settings|env|config|auth|aws-exports|appsettings|runtime-config|composer|phpinfo|_profiler|actuator|wp-(?:admin|content|includes|config)|xmlrpc|server-status|server-info|id_rsa|id_ed25519)(?:[-_.#?/]|$)/i;

/**
 * Checks if a requested URL pathname targets hidden dotfiles or directories (except .well-known).
 */
export function hasDotfileSegment(pathname: string): boolean {
  const segments = pathname.split("/");
  return segments.some(
    (segment) =>
      segment.startsWith(".") &&
      segment !== "." &&
      segment !== ".." &&
      segment !== ".well-known"
  );
}

/**
 * Returns true if the pathname matches known scanner probes or sensitive file patterns.
 */
export function isSensitiveProbe(pathname: string): boolean {
  return SENSITIVE_EXTENSIONS_REGEX.test(pathname) || SENSITIVE_PROBES_REGEX.test(pathname);
}
