// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: 'https://incomparable-cranachan-979404.netlify.app',
	integrations: [mdx(), sitemap()],
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
