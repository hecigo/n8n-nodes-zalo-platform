const { src, dest, parallel } = require('gulp');

function buildIcons() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

// Codex metadata (*.node.json) lives next to the node source and tsc does not
// copy it, so before this it never reached dist and n8n never saw it.
function buildCodex() {
	return src('nodes/**/*.json').pipe(dest('dist/nodes'));
}

exports['build:assets'] = parallel(buildIcons, buildCodex);
