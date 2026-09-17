import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * BullMQ and its ioredis transport are Node-only libraries and must NOT be
   * bundled into the server-component / server-action graph.
   *
   * BullMQ statically re-exports a Valkey-Glide client that lazily require()s the
   * optional '@valkey/valkey-glide' package. We use ioredis, not Valkey, so that
   * module is never loaded at runtime (Node loads BullMQ fine without it — which
   * is why the tsx workers work). But Next's compiler statically analyses the
   * graph, tries to resolve '@valkey/valkey-glide' at build time, and fails
   * ("Module not found"), which breaks importing src/lib/jobs/queue.ts from a
   * Server Action and leaves searches stuck in PENDING.
   *
   * Externalizing makes Next require() these from node_modules at runtime instead
   * of bundling them — identical to how the workers load them. Do NOT install
   * '@valkey/valkey-glide' to silence the warning; it is not a BullMQ dependency
   * and is not needed with ioredis.
   */
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;