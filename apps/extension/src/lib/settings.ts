import { z } from "zod";

const settingsSchema = z.object({
  serverUrl: z.url().optional().catch(undefined),
  apiToken: z.string().min(32).optional().catch(undefined),
  diagnosticsEnabled: z.boolean().default(false).catch(false),
  syncEnabled: z.boolean().default(true).catch(true),
  syncIntervalMinutes: z.number().int().min(5).max(1440).default(15).catch(15),
  lastSuccessfulSync: z.iso.datetime().optional().catch(undefined),
});

export type Settings = z.infer<typeof settingsSchema>;

export function parseSettings(value: unknown): Settings {
  return settingsSchema.parse(value);
}

export async function getSettings(): Promise<Settings> {
  return parseSettings(await chrome.storage.local.get());
}

export async function setSettings(update: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(update);
}
