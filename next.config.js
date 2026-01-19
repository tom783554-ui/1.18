/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString()
  }
};

module.exports = nextConfig;
