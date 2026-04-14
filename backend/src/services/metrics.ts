import { Router } from "express";
import { secretCache } from "./secretCache";

const router = Router();

router.get("/metrics", (_req, res) => {
  const { hits, misses, hit_rate } = secretCache.getMetrics();
  const output = [
    `# HELP cache_hits_total Total cache hits`,
    `# TYPE cache_hits_total counter`,
    `cache_hits_total ${hits}`,
    `# HELP cache_misses_total Total cache misses`,
    `# TYPE cache_misses_total counter`,
    `cache_misses_total ${misses}`,
    `# HELP cache_hit_rate Current cache hit rate`,
    `# TYPE cache_hit_rate gauge`,
    `cache_hit_rate ${hit_rate}`,
  ].join("\n");

  res.set("Content-Type", "text/plain; version=0.0.4");
  res.send(output);
});

export default router;
