// Mirrors the rule set n8n's verification scanner runs
// (`npx @n8n/scan-community-package n8n-nodes-zalo-platform`), so `npm run lint`
// fails here rather than in the review queue.
import { defineConfig } from 'eslint/config';
import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import n8nNodesPlugin from 'eslint-plugin-n8n-nodes-base';
import parser from '@typescript-eslint/parser';

export default defineConfig(
	{ ignores: ['dist/**', 'node_modules/**'] },
	n8nCommunityNodesPlugin.configs.recommended,
	{ rules: { 'no-console': 'error' } },
	{ plugins: { 'n8n-nodes-base': n8nNodesPlugin } },
	{
		files: ['package.json'],
		rules: { ...n8nNodesPlugin.configs.community.rules },
	},
	{
		files: ['**/credentials/**/*.ts'],
		rules: {
			...n8nNodesPlugin.configs.credentials.rules,
			// Not valid for community nodes
			'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			// The community-nodes credential-password-field rule is more accurate
			'n8n-nodes-base/cred-class-field-type-options-password-missing': 'off',
		},
	},
	{
		files: ['**/nodes/**/*.ts'],
		rules: {
			...n8nNodesPlugin.configs.nodes.rules,
			// Inputs and outputs use NodeConnectionTypes instead of the string "main"
			'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
			'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
			// Some APIs do impose a maximum, so maxValue is legitimate
			'n8n-nodes-base/node-param-type-options-max-value-present': 'off',
		},
	},
	// package.json and the codex files are object literals; the TS parser gives
	// the ObjectExpression AST the package.json rules walk.
	{ files: ['**/*.json'], languageOptions: { parser } },
	{ files: ['**/*.ts'], languageOptions: { parser } },
);
