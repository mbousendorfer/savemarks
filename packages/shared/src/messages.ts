import { z } from "zod";
import { normalizedBookmarkSchema, sourceSchema } from "./models";

export const diagnosticEventSchema = z.object({
  id: z.string().uuid(),
  source: sourceSchema,
  occurredAt: z.iso.datetime(),
  transport: z.enum(["fetch", "xhr"]),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
  sanitizedUrl: z.string().max(4096),
  operationName: z.string().max(256).optional(),
  requestShape: z.array(z.string().max(256)).max(500),
  responseShape: z.array(z.string().max(256)).max(2_000),
  status: z.number().int().min(0).max(599),
  cursorPaths: z.array(z.string().max(512)).max(100),
  mutation: z.enum(["save", "unsave"]).optional(),
});

export type DiagnosticEvent = z.infer<typeof diagnosticEventSchema>;

export const pageBridgeMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SAVEMARKS_DIAGNOSTIC_EVENT"),
    version: z.literal(1),
    payload: diagnosticEventSchema,
  }),
  z.object({
    type: z.literal("SAVEMARKS_DETECTED_BOOKMARK"),
    version: z.literal(1),
    payload: normalizedBookmarkSchema,
  }),
  z.object({
    type: z.literal("SAVEMARKS_TEMPLATE_CAPTURED"),
    version: z.literal(1),
    payload: z.object({
      source: sourceSchema,
      url: z.string().max(4096),
      method: z.enum(["GET", "POST"]),
      operationName: z.string().max(256).optional(),
      body: z.unknown().optional(),
      capturedAt: z.iso.datetime(),
      schemaVersion: z.literal(1),
    }),
  }),
]);

export type PageBridgeMessage = z.infer<typeof pageBridgeMessageSchema>;

export const pairingExchangeSchema = z.object({
  code: z.string().regex(/^[A-Z2-9]{8}$/),
  clientName: z.string().trim().min(1).max(128),
});

export const bookmarkIngestSchema = z.object({
  clientItemId: z.string().uuid(),
  bookmark: normalizedBookmarkSchema,
});
