/**
 * Auto-detect the preview deploy URL from platform-specific environment variables.
 * Checks Vercel, Netlify, Render, Railway, and generic PREVIEW_URL.
 */
export function detectPreviewUrl(): string | null {
  // Vercel
  const vercelBranch = process.env.VERCEL_BRANCH_URL;
  if (vercelBranch) return ensureHttps(vercelBranch);
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return ensureHttps(vercelUrl);

  // Netlify
  const netlifyPrime = process.env.DEPLOY_PRIME_URL;
  if (netlifyPrime) return netlifyPrime;
  const netlifyDeploy = process.env.DEPLOY_URL;
  if (netlifyDeploy) return netlifyDeploy;

  // Render
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) return renderUrl;

  // Railway
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain) return ensureHttps(railwayDomain);

  // Cloudflare Pages
  const cfUrl = process.env.CF_PAGES_URL;
  if (cfUrl) return cfUrl;

  // Fly.io
  const flyApp = process.env.FLY_APP_NAME;
  if (flyApp) return `https://${flyApp}.fly.dev`;

  // Generic
  const previewUrl = process.env.PREVIEW_URL;
  if (previewUrl) return previewUrl;

  return null;
}

function ensureHttps(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}
