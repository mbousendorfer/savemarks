import { z } from "zod";

const settingsSchema = z.object({
  serverUrl: z.url().optional(),
  apiToken: z.string().min(32).optional(),
  diagnosticsEnabled: z.boolean().default(false),
  syncEnabled: z.boolean().default(true),
  syncIntervalMinutes: z.number().int().min(5).max(1440).default(15),
  lastSuccessfulSync: z.iso.datetime().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

export async function getSettings(): Promise<Settings> {
  return settingsSchema.parse(await chrome.storage.local.get());
}

export async function setSettings(update: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(update);
}
