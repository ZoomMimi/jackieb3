// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** @type {import('astro').AstroIntegration} */
const simplifyGpxPlugin = {
	name: 'simplify-gpx',
	hooks: {
		'astro:build:start': ({ logger }) => {
			if (!existsSync('.planning/data/gpx')) {
				logger.warn(
					'GPX simplification skipped — no .planning/data/gpx/ directory found. ' +
					'The committed route-track stub will be used; polyline will be empty until GPX files are exported.'
				);
				return;
			}
			logger.info('Running GPX simplification...');
			execSync('node scripts/simplify-gpx.mjs', { stdio: 'inherit' });
		},
	},
};

// https://astro.build/config
export default defineConfig({
	site: 'https://jackieb3.netlify.app',
	integrations: [mdx(), sitemap(), simplifyGpxPlugin],
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Lora',
			cssVariable: '--font-lora',
			weights: ['400', '700'],
			styles: ['normal', 'italic'],
		},
		{
			provider: fontProviders.google(),
			name: 'Inter',
			cssVariable: '--font-inter',
			weights: ['400', '700'],
		},
	],
	vite: {
		plugins: [tailwindcss()],
		build: {
			// @ts-ignore - Workaround for Astro 7 + Vite 8 + Rolldown 1.x tsconfig resolution bug
			rolldownOptions: {
				tsconfig: false,
			},
		},
		environments: {
			prerender: {
				build: {
					// @ts-ignore - Workaround for Rolldown tsconfig resolution in prerender env
					rolldownOptions: {
						tsconfig: false,
					},
				},
			},
		},
	},
});
