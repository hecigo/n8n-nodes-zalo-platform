const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { NodeApiError, NodeOperationError } = require('n8n-workflow');
const { ZaloBotTrigger, API_BASE, WEBHOOK_URL, SECRET, BOT_TOKEN, fixture, runTrigger, hookContext, mockFetch } = require('./helpers');

describe('ZaloBotTrigger.webhook: request verification', () => {
	it('drops a request with a wrong secret token', async () => {
		assert.equal(await runTrigger({ body: fixture('private-text'), secret: 'wrong' }), null);
	});

	it('drops a request with no secret header', async () => {
		assert.equal(await runTrigger({ body: fixture('private-text'), secret: null }), null);
	});

	it('derives the secret from the trimmed bot token', async () => {
		const out = await runTrigger({ body: fixture('private-text'), token: `  ${BOT_TOKEN}\n` });
		assert.equal(out.length, 1);
	});

	it('drops a body without event_name', async () => {
		assert.equal(await runTrigger({ body: { message: {} } }), null);
	});
});

describe('ZaloBotTrigger.webhook: payload shape', () => {
	it('unwraps the { ok, result, error_code } envelope Zalo posts', async () => {
		const body = fixture('group-text');
		const [out] = await runTrigger({ body });
		assert.deepEqual(out, body.result);
		assert.equal(out.ok, undefined);
		assert.equal(out.error_code, undefined);
	});

	it('passes a flat { event_name, message } payload through unchanged', async () => {
		const flat = fixture('private-text').result;
		assert.deepEqual(await runTrigger({ body: flat }), [flat]);
	});

	it('exposes the group ID at message.chat.id (the path the README tells users to map)', async () => {
		const [out] = await runTrigger({ body: fixture('group-text') });
		assert.match(out.message.chat.id, /^zgr-/);
	});

	it('keeps chat.id and from.id apart for a group message', async () => {
		const [{ message }] = await runTrigger({ body: fixture('group-text') });
		assert.equal(message.chat.chat_type, 'GROUP');
		assert.notEqual(message.chat.id, message.from.id, 'replying to from.id would land in the private inbox');
	});

	it('private message: chat.id equals from.id', async () => {
		const [{ message }] = await runTrigger({ body: fixture('private-text') });
		assert.equal(message.chat.id, message.from.id);
	});
});

describe('ZaloBotTrigger.webhook: event filter', () => {
	const sticker = () => {
		const body = fixture('private-text');
		body.result.event_name = 'message.sticker.received';
		return body;
	};

	it('anyMessage passes every event', async () => {
		assert.ok(await runTrigger({ body: sticker() }));
	});

	it('a specific event passes only that event', async () => {
		const params = { event: 'message.text.received' };
		assert.ok(await runTrigger({ params, body: fixture('private-text') }));
		assert.equal(await runTrigger({ params, body: sticker() }), null);
	});
});

describe('ZaloBotTrigger.webhook: chat type filter', () => {
	const cases = [
		// [chatType param, fixture, passes]
		[undefined, 'private-text', true],
		[undefined, 'group-text', true],
		['all', 'private-text', true],
		['all', 'group-text', true],
		['PRIVATE', 'private-text', true],
		['PRIVATE', 'group-text', false],
		['GROUP', 'group-text', true],
		['GROUP', 'private-text', false],
	];
	for (const [chatType, name, passes] of cases) {
		const label = chatType === undefined ? 'not set (workflow saved before 2.1.0)' : chatType;
		it(`${label} + ${name} -> ${passes ? 'pass' : 'drop'}`, async () => {
			const params = { event: 'anyMessage', ...(chatType && { chatType }) };
			const out = await runTrigger({ params, body: fixture(name) });
			assert.equal(out !== null, passes);
		});
	}

	it('combines with the event filter', async () => {
		const params = { event: 'message.text.received', chatType: 'GROUP' };
		const groupSticker = fixture('group-text');
		groupSticker.result.event_name = 'message.sticker.received';
		assert.equal(await runTrigger({ params, body: groupSticker }), null);
		assert.ok(await runTrigger({ params, body: fixture('group-text') }));
	});

	it('filters on chat_type inside a wrapped payload', async () => {
		const params = { event: 'anyMessage', chatType: 'PRIVATE' };
		assert.equal(await runTrigger({ params, body: fixture('group-text') }), null);
		assert.ok(await runTrigger({ params, body: fixture('private-text') }));
	});

	it('drops a payload with no chat when filtering', async () => {
		const body = { event_name: 'message.text.received', message: {} };
		assert.equal(await runTrigger({ params: { event: 'anyMessage', chatType: 'GROUP' }, body }), null);
	});
});

describe('ZaloBotTrigger: node description', () => {
	const props = new ZaloBotTrigger().description.properties;

	it('offers a chatType option defaulting to all', () => {
		const p = props.find((x) => x.name === 'chatType');
		assert.equal(p.default, 'all');
		assert.deepEqual(p.options.map((o) => o.value), ['all', 'PRIVATE', 'GROUP']);
	});
});

describe('ZaloBotTrigger: webhook lifecycle', () => {
	const methods = new ZaloBotTrigger().webhookMethods.default;

	it('checkExists is true only when Zalo has our URL', async (t) => {
		let url = WEBHOOK_URL;
		const calls = mockFetch(t, () => ({ ok: true, result: { url } }));
		assert.equal(await methods.checkExists.call(hookContext()), true);
		url = 'https://elsewhere.example.com/hook';
		assert.equal(await methods.checkExists.call(hookContext()), false);
		assert.equal(calls[0].url, `${API_BASE}/getWebhookInfo`);
	});

	it('checkExists is false when no webhook is set', async (t) => {
		mockFetch(t, () => ({ ok: false }));
		assert.equal(await methods.checkExists.call(hookContext()), false);
	});

	it('checkExists raises when the API is unreachable', async (t) => {
		mockFetch(t, () => {
			throw new Error('ECONNRESET');
		});
		await assert.rejects(methods.checkExists.call(hookContext()), NodeApiError);
	});

	it('create registers the URL with the derived secret', async (t) => {
		const calls = mockFetch(t, () => ({ ok: true }));
		assert.equal(await methods.create.call(hookContext()), true);
		assert.equal(calls[0].url, `${API_BASE}/setWebhook`);
		assert.deepEqual(calls[0].body, { url: WEBHOOK_URL, secret_token: SECRET });
	});

	it('create raises with Zalo\'s description on failure', async (t) => {
		mockFetch(t, () => ({ ok: false, description: 'Invalid url' }));
		await assert.rejects(methods.create.call(hookContext()), (e) => e instanceof NodeOperationError && /Invalid url/.test(e.message));
	});

	it('delete never blocks deactivation but logs a warning', async (t) => {
		mockFetch(t, () => {
			throw new Error('timeout');
		});
		const ctx = hookContext();
		assert.equal(await methods.delete.call(ctx), true);
		assert.equal(ctx.warnings.length, 1);
		assert.match(ctx.warnings[0], /timeout/);
	});
});
