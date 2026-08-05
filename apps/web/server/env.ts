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
});
export type Environment = z.infer<typeof schema>;
export function parseEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  return schema.parse(input);
}
