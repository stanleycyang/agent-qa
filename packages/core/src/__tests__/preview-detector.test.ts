import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectPreviewUrl } from "../preview-detector.js";

const ENV_KEYS = [
  "VERCEL_BRANCH_URL",
  "VERCEL_URL",
  "DEPLOY_PRIME_URL",
  "DEPLOY_URL",
  "RENDER_EXTERNAL_URL",
  "RAILWAY_PUBLIC_DOMAIN",
  "CF_PAGES_URL",
  "FLY_APP_NAME",
  "PREVIEW_URL",
];

describe("detectPreviewUrl", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("returns null when no env vars are set", () => {
    expect(detectPreviewUrl()).toBeNull();
  });

  it("detects Vercel VERCEL_BRANCH_URL with https", () => {
    process.env.VERCEL_BRANCH_URL = "my-app-git-branch.vercel.app";
    expect(detectPreviewUrl()).toBe("https://my-app-git-branch.vercel.app");
  });

  it("detects Vercel VERCEL_URL as fallback", () => {
    process.env.VERCEL_URL = "my-app.vercel.app";
    expect(detectPreviewUrl()).toBe("https://my-app.vercel.app");
  });

  it("VERCEL_BRANCH_URL takes priority over VERCEL_URL", () => {
    process.env.VERCEL_BRANCH_URL = "branch.vercel.app";
    process.env.VERCEL_URL = "main.vercel.app";
    expect(detectPreviewUrl()).toBe("https://branch.vercel.app");
  });

  it("detects Netlify DEPLOY_PRIME_URL as-is", () => {
    process.env.DEPLOY_PRIME_URL = "https://deploy-preview-42--my-site.netlify.app";
    expect(detectPreviewUrl()).toBe("https://deploy-preview-42--my-site.netlify.app");
  });

  it("detects Netlify DEPLOY_URL as fallback", () => {
    process.env.DEPLOY_URL = "https://abc123--my-site.netlify.app";
    expect(detectPreviewUrl()).toBe("https://abc123--my-site.netlify.app");
  });

  it("detects Render RENDER_EXTERNAL_URL", () => {
    process.env.RENDER_EXTERNAL_URL = "https://my-app.onrender.com";
    expect(detectPreviewUrl()).toBe("https://my-app.onrender.com");
  });

  it("detects Railway RAILWAY_PUBLIC_DOMAIN with https", () => {
    process.env.RAILWAY_PUBLIC_DOMAIN = "my-app.up.railway.app";
    expect(detectPreviewUrl()).toBe("https://my-app.up.railway.app");
  });

  it("detects Cloudflare CF_PAGES_URL", () => {
    process.env.CF_PAGES_URL = "https://abc123.my-app.pages.dev";
    expect(detectPreviewUrl()).toBe("https://abc123.my-app.pages.dev");
  });

  it("detects Fly.io FLY_APP_NAME and constructs URL", () => {
    process.env.FLY_APP_NAME = "my-fly-app";
    expect(detectPreviewUrl()).toBe("https://my-fly-app.fly.dev");
  });

  it("detects generic PREVIEW_URL", () => {
    process.env.PREVIEW_URL = "http://localhost:3000";
    expect(detectPreviewUrl()).toBe("http://localhost:3000");
  });

  it("Vercel has higher priority than Netlify", () => {
    process.env.VERCEL_URL = "vercel.app";
    process.env.DEPLOY_PRIME_URL = "https://netlify.app";
    expect(detectPreviewUrl()).toBe("https://vercel.app");
  });

  it("does not double-prepend https:// for Vercel URLs", () => {
    process.env.VERCEL_URL = "https://already-https.vercel.app";
    expect(detectPreviewUrl()).toBe("https://already-https.vercel.app");
  });

  it("preserves http:// for Vercel URLs", () => {
    process.env.VERCEL_URL = "http://localhost:3000";
    expect(detectPreviewUrl()).toBe("http://localhost:3000");
  });
});
