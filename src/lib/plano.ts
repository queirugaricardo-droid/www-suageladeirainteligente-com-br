import { z } from "zod";

// Validate each image, without a monthly or per-analysis count quota.
export const imagensAnaliseSchema = z.object({
  imagens: z.array(z.string().min(50).max(12_000_000)).min(1),
});
