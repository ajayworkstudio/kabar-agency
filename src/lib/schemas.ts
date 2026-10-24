import { z } from "zod";
import { ALL_TARGETS } from "@/pipeline/approve";

export const AgentInput = z.object({
  name: z.string().trim().min(2).max(40),
  role: z.string().trim().min(2).max(80),
  kind: z.enum(["writer", "designer"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(["active", "paused"]).optional(),
  platforms: z.array(z.enum(ALL_TARGETS)).optional(),
  categories: z.array(z.enum(["politik", "olahraga", "hiburan", "ekonomi", "teknologi", "umum"])).optional(),
  responsibilities: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  settings: z
    .object({
      minSources: z.number().int().min(1).max(10),
      minSourcesPolitics: z.number().int().min(1).max(10),
      maxDraftsPerDay: z.number().int().min(0).max(100),
      reportHour: z.number().int().min(0).max(23),
      focus: z.enum(["general", "genz"]),
      palette: z.object({ bg: z.string().regex(/^#[0-9a-fA-F]{6}$/), fg: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
      format: z.enum(["post", "square", "story"]),
    })
    .partial()
    .optional(),
});

