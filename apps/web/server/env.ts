import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  SLEEPER_API_BASE_URL: z.string().url().default("https://api.sleeper.app/v1"),
  FANTASYPROS_API_KEY: z.string().min(1).optional(),
  FANTASY_FOOTBALL_CALCULATOR_API_BASE_URL: z
    .string()
    .url()
    .default("https://fantasyfootballcalculator.com/api/v1"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_URL: z.string().url().default("https://qstash-us-east-1.upstash.io"),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  APP_URL: z.string().url().optional(),
  // Vercel injects this system variable when Protection Bypass for Automation
  // is enabled. QStash cannot send the header, so we add it to its destination.
  VERCEL_AUTOMATION_BYPASS_SECRET: z.string().min(1).optional(),
  LIVE_DRAFT_POLL_SECONDS: z.coerce.number().int().min(5).max(60).default(10),
});
export type Environment = z.infer<typeof schema>;
export function parseEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  return schema.parse(input);
}
