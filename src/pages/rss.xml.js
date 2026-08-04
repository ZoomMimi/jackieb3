import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	// Local-preview-only escape hatch: PREVIEW_DRAFTS=1 (set via `npm run dev:drafts`) makes
	// draft posts visible. A production build must NEVER set this env var.
	const posts = await getCollection(
		'blog',
		({ data }) => !data.draft || import.meta.env.PREVIEW_DRAFTS === '1',
	);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			pubDate: post.data.date,
			description: post.data.excerpt,
			link: `/blog/${post.id}/`,
		})),
	});
}
