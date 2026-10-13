// Minimal stand-ins for the n8n execution contexts. Tests run against the compiled
// nodes in dist/, which is exactly what ships to npm.
const { createHash } = require('crypto');
const { ZaloBot } = require('../dist/nodes/ZaloBot/ZaloBot.node.js');
const { ZaloBotTrigger } = require('../dist/nodes/ZaloBot/ZaloBotTrigger.node.js');

const BOT_TOKEN = '1234567890:test-secret-key';
const API_BASE = `https://bot-api.zaloplatforms.com/bot${BOT_TOKEN}`;
const WEBHOOK_URL = 'https://n8n.example.com/webhook/abc/webhook';
const SECRET = createHash('sha256').update(BOT_TOKEN).digest('hex').substring(0, 32);

const NODE = { id: '1', name: 'Zalo Bot', type: 'n8n-nodes-zalo-platform.zaloBot', typeVersion: 1, position: [0, 0], parameters: {} };

// Like n8n, a parameter the workflow never saved resolves to the fallback.
function paramGetter(params) {
	return (name, _itemIndexOrFallback, fallback) => {
		if (name in params) return params[name];
		return typeof _itemIndexOrFallback === 'number' ? fallback : _itemIndexOrFallback;
	};
}

function fixture(name) {
	return structuredClone(require(`./fixtures/${name}.json`));
}

/** Runs ZaloBotTrigger.webhook and returns the emitted items, or null when dropped. */
async function runTrigger({ params = { event: 'anyMessage' }, body, secret = SECRET, token = BOT_TOKEN }) {
	const ctx = {
		getRequestObject: () => ({ headers: secret === null ? {} : { 'x-bot-api-secret-token': secret }, body }),
		getNodeParameter: paramGetter(params),
		getCredentials: async () => ({ botToken: token }),
		helpers: { returnJsonArray: (data) => (Array.isArray(data) ? data : [data]).map((json) => ({ json })) },
	};
	const res = await new ZaloBotTrigger().webhook.call(ctx);
	return res.workflowData ? res.workflowData[0].map((i) => i.json) : null;
}

/** Context for the trigger's webhook lifecycle methods (checkExists / create / delete). */
function hookContext({ token = BOT_TOKEN } = {}) {
	const warnings = [];
	return {
		warnings,
		getCredentials: async () => ({ botToken: token }),
		getNodeWebhookUrl: () => WEBHOOK_URL,
		getNode: () => NODE,
		logger: { warn: (m) => warnings.push(m) },
	};
}

/**
 * Runs ZaloBot.execute. `respond(request)` plays the Zalo API; every outgoing
 * request is recorded in `requests`.
 */
async function runAction({ params, items = [{ json: {} }], respond = () => ({ ok: true, result: {} }), continueOnFail = false, token = BOT_TOKEN }) {
	const requests = [];
	const ctx = {
		getInputData: () => items,
		getCredentials: async () => ({ botToken: token }),
		getNodeParameter: (name, i) => {
			const p = typeof params === 'function' ? params(i) : params;
			return p[name];
		},
		getNode: () => NODE,
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequest: async (options) => {
				requests.push(options);
				return respond(options);
			},
			returnJsonArray: (data) => (Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (items, { itemData }) => items.map((it) => ({ ...it, pairedItem: itemData })),
		},
	};
	const [out] = await new ZaloBot().execute.call(ctx);
	return { out, requests };
}

/** Replaces global fetch for one test; returns the recorded calls. */
function mockFetch(t, handler) {
	const calls = [];
	const original = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		calls.push({ url, body: init.body ? JSON.parse(init.body) : undefined });
		const json = await handler(url, init);
		return { json: async () => json };
	};
	t.after(() => {
		globalThis.fetch = original;
	});
	return calls;
}

module.exports = { ZaloBot, ZaloBotTrigger, BOT_TOKEN, API_BASE, WEBHOOK_URL, SECRET, fixture, runTrigger, hookContext, runAction, mockFetch };
