export const applicationEnvironment = {
  name: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  service: "apollomd",
} as const;
