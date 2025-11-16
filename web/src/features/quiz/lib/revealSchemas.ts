import { z } from 'zod'

export const RevealLinkSchema = z.object({
  provider: z.enum(['youtube', 'appleMusic', 'spotify', 'other']),
  url: z.string().url(),
  label: z.string().optional(),
})

export const RevealMetaSchema = z.object({
  workTitle: z.string().min(1).optional(),
  trackTitle: z.string().min(1).optional(),
  composer: z.string().min(1).optional(),
})

export const RevealSchema = z.object({
  links: z.array(RevealLinkSchema).optional(),
  questionId: z.string().min(1).optional(),
  choiceId: z.string().min(1).optional(),
  correct: z.boolean().optional(),
  correctChoiceId: z.string().min(1).optional(),
  meta: RevealMetaSchema.optional(),
})
