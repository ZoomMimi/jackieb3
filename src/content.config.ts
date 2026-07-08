import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog/great-loop' }),
	schema: z.object({
		// Required fields (D-11)
		title: z.string(),
		date: z.coerce.date(),
		voyage: z.string(),       // slug: "great-loop"
		location: z.string(),     // human-readable: "Chesapeake Bay, MD"
		excerpt: z.string(),
		migrated: z.boolean().default(false),

		// Quality-lift flag (D-08): marks posts that have been AI-quality-lifted
		lifted: z.boolean().default(false),

		// Optional voyage-stats fields (D-06): populated by lift script from nebo-logs
		miles: z.number().optional(),
		hours: z.number().optional(),
		stops: z.number().optional(),
		startLocation: z.string().optional(),
		endLocation: z.string().optional(),

		// Optional fields (D-08, D-09, D-10)
		lat: z.number().optional(),
		lon: z.number().optional(),
		coverPhoto: z.string().optional(),  // URL string
		anchorage: z.string().optional(),   // free text (D-10: not enum)
		marina: z.string().optional(),      // free text
	}),
});

const voyages = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/voyages' }),
	schema: z.object({
		name: z.string(),
		slug: z.string(),
		startDate: z.coerce.date(),
		endDate: z.coerce.date().optional(),
		description: z.string(),
	}),
});

export const collections = { blog, voyages };
