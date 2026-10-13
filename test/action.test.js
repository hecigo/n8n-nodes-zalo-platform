const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { NodeApiError, NodeOperationError } = require('n8n-workflow');
const { API_BASE, BOT_TOKEN, fixture, runTrigger, runAction } = require('./helpers');

describe('ZaloBot: request mapping', () => {
	const cases = [
		['getMe', {}, '/getMe', undefined],
		['getUpdates', { timeout: 30 }, '/getUpdates', undefined],
		['getUpdates', { timeout: 0 }, '/getUpdates', { timeout: '0' }],
		['sendMessage', { chatId: 'c1', text: 'hi' }, '/sendMessage', { chat_id: 'c1', text: 'hi' }],
		['sendPhoto', { chatId: 'c1', photo: 'https://x/y.jpg', caption: '' }, '/sendPhoto', { chat_id: 'c1', photo: 'https://x/y.jpg' }],
		['sendPhoto', { chatId: 'c1', photo: 'https://x/y.jpg', caption: 'cap' }, '/sendPhoto', { chat_id: 'c1', photo: 'https://x/y.jpg', caption: 'cap' }],
		['sendSticker', { chatId: 'c1', stickerId: 's1' }, '/sendSticker', { chat_id: 'c1', sticker: 's1' }],
		['sendChatAction', { chatId: 'c1', action: 'typing' }, '/sendChatAction', { chat_id: 'c1', action: 'typing' }],
		['setWebhook', { webhookUrl: 'https://h/w', secretToken: 'secret123' }, '/setWebhook', { url: 'https://h/w', secret_token: 'secret123' }],
		['deleteWebhook', {}, '/deleteWebhook', undefined],
		['getWebhookInfo', {}, '/getWebhookInfo', undefined],
	];
	for (const [operation, params, endpoint, body] of cases) {
		it(`${operation} ${JSON.stringify(params)} -> POST ${endpoint}`, async () => {
			const { requests } = await runAction({ params: { operation, ...params } });
			assert.equal(requests.length, 1);
			assert.equal(requests[0].method, 'POST');
			assert.equal(requests[0].url, `${API_BASE}${endpoint}`);
			assert.deepEqual(requests[0].body, body);
		});
	}

	it('trims whitespace around the bot token', async () => {
		const { requests } = await runAction({ params: { operation: 'getMe' }, token: ` ${BOT_TOKEN} \n` });
		assert.equal(requests[0].url, `${API_BASE}/getMe`);
	});

	it('runs once per input item, with per-item parameters', async () => {
		const { out, requests } = await runAction({
			items: [{ json: {} }, { json: {} }],
			params: (i) => ({ operation: 'sendMessage', chatId: `c${i}`, text: 't' }),
		});
		assert.deepEqual(requests.map((r) => r.body.chat_id), ['c0', 'c1']);
		assert.deepEqual(out.map((o) => o.pairedItem), [{ item: 0 }, { item: 1 }]);
	});
});

describe('ZaloBot: replying from the trigger', () => {
	// The reported bug: the bot answered a group message in the sender's private
	// inbox. Mapping Chat ID from message.chat.id keeps the reply in the group.
	it('chat.id of a real group message sends the reply to the group', async () => {
		const [trigger] = await runTrigger({ body: fixture('group-text') });
		const { requests } = await runAction({ params: { operation: 'sendMessage', chatId: trigger.message.chat.id, text: 'ok' } });
		assert.equal(requests[0].body.chat_id, trigger.message.chat.id);
		assert.notEqual(requests[0].body.chat_id, trigger.message.from.id);
	});
});

describe('ZaloBot: errors', () => {
	it('ok:false raises NodeApiError with Zalo\'s description', async () => {
		await assert.rejects(
			runAction({ params: { operation: 'sendMessage', chatId: 'c', text: 't' }, respond: () => ({ ok: false, error_code: 400, description: 'chat not found' }) }),
			(e) => e instanceof NodeApiError && e.message === 'Zalo Bot API error: chat not found',
		);
	});

	it('wraps a network failure in NodeApiError', async () => {
		await assert.rejects(
			runAction({
				params: { operation: 'getMe' },
				respond: () => {
					throw new Error('ECONNRESET');
				},
			}),
			NodeApiError,
		);
	});

	it('an unknown operation raises NodeOperationError', async () => {
		await assert.rejects(runAction({ params: { operation: 'nope' } }), NodeOperationError);
	});

	it('continueOnFail turns the failure into an error item and keeps going', async () => {
		const { out } = await runAction({
			items: [{ json: {} }, { json: {} }],
			params: (i) => ({ operation: 'sendMessage', chatId: `c${i}`, text: 't' }),
			respond: (req) => (req.body.chat_id === 'c0' ? { ok: false, description: 'blocked' } : { ok: true, result: { message_id: 'm' } }),
			continueOnFail: true,
		});
		assert.equal(out.length, 2);
		assert.match(out[0].json.error, /blocked/);
		assert.deepEqual(out[1].json, { ok: true, result: { message_id: 'm' } });
	});
});
