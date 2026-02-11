
// Stolen from https://www.coryzue.com/writing/bluesky-comments/
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { BlueskyComments, BlueskyFilters } from 'https://unpkg.com/bluesky-comments@0.13.1/dist/bluesky-comments.es.js';

export function initComments(str) {
	const uri = `https://bsky.app/profile/needleful.net/post/${str}`;
	const author = 'needleful.net';
	const container = document.getElementById('bluesky-comments');
	const root = createRoot(container);
	root.render(
		createElement(BlueskyComments, {
			author: author,
			uri: uri,
			commentFilters: [BlueskyFilters.NoPins],
			onEmpty: (details) => {
				console.log('Failed to load comments:', details);
				document.getElementById('bluesky-comments').innerHTML = '';
			},
		})
	);
}