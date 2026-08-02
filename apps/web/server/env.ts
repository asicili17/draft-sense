import { z } from "zod";
const schema = z.object({ DATABASE_URL: z.string().url(), REDIS_URL: z.string().url(), SLEEPER_API_BASE_URL: z.string().url().default("https://api.sleeper.app/v1"), MYSPORTSFEEDS_API_KEY: z.string().min(1), FANTASY_FOOTBALL_CALCULATOR_API_BASE_URL: z.string().url().default("https://fantasyfootballcalculator.com/api/v1"), OPENAI_API_KEY: z.string().min(1), CRON_SECRET: z.string().min(24) });
export type Environment = z.infer<typeof schema>;
export function parseEnvironment(input: NodeJS.ProcessEnv = process.env): Environment { return schema.parse(input); }
