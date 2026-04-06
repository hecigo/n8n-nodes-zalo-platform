import {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';
import { createHash } from 'crypto';

const HELP_NOTICE = 'Need help? Visit https://thenexova.com/n8n-zalo-bot-node-complete-setup-and-operations-guide/ or contact THE NEXOVA team at contact@thenexova.com';

/**
 * Derive a deterministic secret token from bot token.
 * Used for webhook verification - no manual input needed.
 */
function deriveSecretToken(botToken: string): string {
	return createHash('sha256').update(botToken).digest('hex').substring(0, 32);
}

/**
 * Call Zalo Bot API.
 */
async function callZaloApi(
	baseUrl: string,
	method: string,
	body?: Record<string, unknown>,
	timeoutMs = 10000,
): Promise<IDataObject> {
	const response = await fetch(`${baseUrl}/${method}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(timeoutMs),
	});
	return (await response.json()) as IDataObject;
}

export class ZaloBotTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zalo Bot Trigger',
		name: 'zaloBotTrigger',
		icon: 'file:zalobot.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Receive messages and events via webhook with auto-registration. Compatible with official Zalo Bot Platform.',
		defaults: {
			name: 'Zalo Bot Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'zaloBotApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Any Message',
						value: 'anyMessage',
						description: 'Trigger on any incoming message type',
					},
					{
						name: 'Text Message',
						value: 'message.text.received',
						description: 'Trigger only on text messages',
					},
					{
						name: 'Image Message',
						value: 'message.image.received',
						description: 'Trigger only on image messages',
					},
					{
						name: 'Sticker Message',
						value: 'message.sticker.received',
						description: 'Trigger only on sticker messages',
					},
				],
				default: 'anyMessage',
			},
		],
		triggerPanel: {
			header: 'Pull in events from Zalo Bot',
			executionsHelp: {
				inactive: 'Click <b>Test step</b>, then send a message to your Zalo bot.',
				active: 'Your workflow is active and receiving Zalo bot messages.',
			},
			activationHint: 'Activate this workflow to start receiving messages from your Zalo bot.',
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('zaloBotApi');
				const botToken = (credentials.botToken as string).trim();
				const baseUrl = `https://bot-api.zaloplatforms.com/bot${botToken}`;
				const webhookUrl = this.getNodeWebhookUrl('default')!;

				try {
					const data = await callZaloApi(baseUrl, 'getWebhookInfo');
					if (data.ok && (data.result as IDataObject)?.url === webhookUrl) {
						return true;
					}
				} catch {
					// Not set
				}
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('zaloBotApi');
				const botToken = (credentials.botToken as string).trim();
				const baseUrl = `https://bot-api.zaloplatforms.com/bot${botToken}`;
				const webhookUrl = this.getNodeWebhookUrl('default')!;
				const secretToken = deriveSecretToken(botToken);

				const data = await callZaloApi(baseUrl, 'setWebhook', {
					url: webhookUrl,
					secret_token: secretToken,
				});

				if (!data.ok) {
					const msg = (data.description as string) ?? 'Unknown error';
					throw new NodeOperationError(this.getNode(), `Failed to set Zalo webhook: ${msg}`, { description: HELP_NOTICE });
				}
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('zaloBotApi');
				const botToken = (credentials.botToken as string).trim();
				const baseUrl = `https://bot-api.zaloplatforms.com/bot${botToken}`;

				try {
					await callZaloApi(baseUrl, 'deleteWebhook');
				} catch {
					// Ignore cleanup errors
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const event = this.getNodeParameter('event') as string;
		const credentials = await this.getCredentials('zaloBotApi');
		const botToken = (credentials.botToken as string).trim();
		const expectedSecret = deriveSecretToken(botToken);

		// Verify secret token header
		const incomingToken = req.headers['x-bot-api-secret-token'] as string;
		if (incomingToken !== expectedSecret) {
			return { noWebhookResponse: true };
		}

		// Zalo sends flat { event_name, message } payload
		// Handle both flat and wrapped { ok, result: { ... } } formats
		const body = req.body as IDataObject;
		const data = (body.result as IDataObject) ?? body;

		if (!data.event_name) {
			return { noWebhookResponse: true };
		}

		// Filter by event type
		if (event !== 'anyMessage') {
			const eventName = data.event_name as string;
			if (eventName !== event) {
				return { noWebhookResponse: true };
			}
		}

		return {
			workflowData: [this.helpers.returnJsonArray(data)],
		};
	}
}
