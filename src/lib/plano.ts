import { z } from "zod";

// Security boundary: no monthly quota is imposed, but each request is bounded
// to prevent oversized payloads from exhausting server/AI resources.
export const imagensAnaliseSchema = z.object({
  imagens: z.array(z.string().min(50).max(8_000_000)).min(1).max(6),
});
