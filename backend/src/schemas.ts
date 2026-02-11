/**
 * UAS Backend — Request Validation Schemas (Zod)
 *
 * All API input is validated before hitting route handlers.
 */

import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// ─── Profiles ────────────────────────────────────────────────

export const CreateProfileSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional().default(""),
  data: z.object({
    apps: z.array(
      z.object({
        id: z.string().min(1),
        version: z.string().optional(),
        optional: z.boolean().optional(),
      }),
    ),
    metadata: z
      .object({
        tags: z.array(z.string()).optional(),
        platform: z.string().optional(),
      })
      .optional(),
  }),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
  data: z
    .object({
      apps: z.array(
        z.object({
          id: z.string().min(1),
          version: z.string().optional(),
          optional: z.boolean().optional(),
        }),
      ),
      metadata: z
        .object({
          tags: z.array(z.string()).optional(),
          platform: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// ─── Machines ────────────────────────────────────────────────

export const RegisterMachineSchema = z.object({
  name: z.string().min(1).max(128),
  hostname: z.string().max(255).optional().default(""),
  os_version: z.string().max(64).optional().default(""),
});

// ─── Install History ─────────────────────────────────────────

export const RecordInstallSchema = z.object({
  machine_id: z.string().uuid(),
  app_id: z.string().min(1).max(64),
  version: z.string().min(1),
  action: z.enum(["install", "uninstall", "upgrade", "rollback"]),
  status: z.enum(["success", "failed", "partial"]),
  details: z.record(z.unknown()).optional().default({}),
});

export type RegisterBody = z.infer<typeof RegisterSchema>;
export type LoginBody = z.infer<typeof LoginSchema>;
export type CreateProfileBody = z.infer<typeof CreateProfileSchema>;
export type UpdateProfileBody = z.infer<typeof UpdateProfileSchema>;
export type RegisterMachineBody = z.infer<typeof RegisterMachineSchema>;
export type RecordInstallBody = z.infer<typeof RecordInstallSchema>;
