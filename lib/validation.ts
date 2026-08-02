import { z } from 'zod';

const email = z.string().trim().email().max(120);
const name = z.string().trim().min(2).max(100);

export const studentCreateSchema = z.object({
  id: z.string().min(1).max(60).optional(),
  name: z.string().trim().min(2).max(100),
  lastName: z.string().trim().max(100).optional(),
  documentId: z.string().trim().regex(/^\d{6,10}$/).optional().or(z.literal('').transform(() => undefined)),
  email: email.optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().trim().regex(/^\d{7,10}$/).optional().or(z.literal('').transform(() => undefined)),
  career: z.string().trim().min(2).max(100),
  lab: z.string().trim().min(1).max(30),
  labs: z.array(z.string().min(1).max(30)).max(20).optional(),
  photoUrl: z.string().url().max(500).optional(),
  photoKey: z.string().max(500).optional(),
  matchPercentage: z.number().min(0).max(100).optional(),
  status: z.enum(['allowed', 'denied']).optional(),
  avatarInitials: z.string().trim().min(1).max(4),
  faceEmbeddingId: z.string().max(200).optional(),
}).strict();

export const userCreateSchema = z.object({
  email: email,
  password: z.string().min(6).max(128),
  name: name,
}).strict();

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  email: email.optional(),
  password: z.string().min(6).max(128).optional(),
  name: name.optional(),
}).strict();

export const labCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,12}$/),
  description: z.string().trim().max(200).optional(),
  active: z.boolean().optional(),
}).strict();

export const labUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,12}$/).optional(),
  description: z.string().trim().max(200).optional(),
  active: z.boolean().optional(),
}).strict();
