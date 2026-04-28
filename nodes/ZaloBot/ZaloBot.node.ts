import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
	JsonObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

const HELP_NOTICE = 'Need help? Visit https://hecigo.com or contact hecigo team at contact@hecigo.com';

export class ZaloBot implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zalo Bot',
		name: 'zaloBot',
		icon: 'file:zalobot.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Send messages, photos, stickers, chat actions and manage webhooks. Compatible with official Zalo Bot Platform.',
		defaults: {
			name: 'Zalo Bot',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'zaloBotApi',
				required: true,
			},
		],
		properties: [
			// ------ Operation ------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Bot Info',
						value: 'getMe',
						description: 'Get information about the bot',
						action: 'Get bot info',
					},
					{
						name: 'Get Updates',
						value: 'getUpdates',
						description: 'Fetch incoming messages via long polling',
						action: 'Get updates',
					},
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a text message to a user or group',
						action: 'Send a message',
					},
					{
						name: 'Send Photo',
						value: 'sendPhoto',
						description: 'Send a photo to a user or group',
						action: 'Send a photo',
					},
					{
						name: 'Send Chat Action',
						value: 'sendChatAction',
						description: 'Display a typing or upload indicator in a conversation',
						action: 'Send a chat action',
					},
					{
						name: 'Send Sticker',
						value: 'sendSticker',
						description: 'Send a sticker to a user or group',
						action: 'Send a sticker',
					},
					{
						name: 'Set Webhook',
						value: 'setWebhook',
						description: 'Configure a webhook URL to receive updates',
						action: 'Set webhook',
					},
					{
						name: 'Delete Webhook',
						value: 'deleteWebhook',
						description: 'Remove the current webhook configuration',
						action: 'Delete webhook',
					},
					{
						name: 'Get Webhook Info',
						value: 'getWebhookInfo',
						description: 'Get information about the current webhook',
						action: 'Get webhook info',
					},
				],
				default: 'sendMessage',
			},

			// ------ Send Message ------
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '1234567890',
				description: 'User ID or Group ID to send the message to',
				displayOptions: {
					show: {
						operation: ['sendMessage', 'sendPhoto', 'sendSticker', 'sendChatAction'],
					},
				},
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 4 },
				placeholder: 'Hello from n8n!',
				description: 'Text message content (1-2000 characters)',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
					},
				},
			},

			// ------ Send Photo ------
			{
				displayName: 'Photo URL',
				name: 'photo',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/image.jpg',
				description: 'URL of the image to send',
				displayOptions: {
					show: {
						operation: ['sendPhoto'],
					},
				},
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				placeholder: 'Optional caption...',
				description: 'Caption to display below the photo (1-2000 characters)',
				displayOptions: {
					show: {
						operation: ['sendPhoto'],
					},
				},
			},

			// ------ Send Sticker ------
			{
				displayName: 'Sticker ID',
				name: 'stickerId',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'bfe458bf64fa8da4d4eb',
				description: 'ID of the sticker to send',
				displayOptions: {
					show: {
						operation: ['sendSticker'],
					},
				},
			},

			// ------ Send Chat Action ------
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				required: true,
				options: [
					{
						name: 'Typing',
						value: 'typing',
						description: 'Bot is typing a message',
					},
					{
						name: 'Upload Photo',
						value: 'upload_photo',
						description: 'Bot is uploading a photo',
					},
				],
				default: 'typing',
				description: 'Type of action to display to the user',
				displayOptions: {
					show: {
						operation: ['sendChatAction'],
					},
				},
			},

			// ------ Get Updates ------
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeout',
				type: 'number',
				default: 30,
				description: 'Timeout in seconds for long polling. Use 0 for short polling.',
				displayOptions: {
					show: {
						operation: ['getUpdates'],
					},
				},
			},

			// ------ Set Webhook ------
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://your-domain.com/webhook',
				description: 'HTTPS URL to receive webhook notifications',
				displayOptions: {
					show: {
						operation: ['setWebhook'],
					},
				},
			},
			{
				displayName: 'Secret Token',
				name: 'secretToken',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				description: 'Secret token (8-256 characters) sent in X-Bot-Api-Secret-Token header to verify requests',
				displayOptions: {
					show: {
						operation: ['setWebhook'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('zaloBotApi');
		const botToken = (credentials.botToken as string).trim();
		const baseUrl = `https://bot-api.zaloplatforms.com/bot${botToken}`;

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: unknown;

				if (operation === 'getMe') {
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/getMe');
				} else if (operation === 'getUpdates') {
					const timeout = this.getNodeParameter('timeout', i) as number;
					const body: Record<string, unknown> = {};
					if (timeout !== 30) body.timeout = String(timeout);
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/getUpdates', body);
				} else if (operation === 'sendMessage') {
					const chatId = this.getNodeParameter('chatId', i) as string;
					const text = this.getNodeParameter('text', i) as string;
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/sendMessage', {
						chat_id: chatId,
						text,
					});
				} else if (operation === 'sendPhoto') {
					const chatId = this.getNodeParameter('chatId', i) as string;
					const photo = this.getNodeParameter('photo', i) as string;
					const caption = this.getNodeParameter('caption', i) as string;
					const body: Record<string, unknown> = { chat_id: chatId, photo };
					if (caption) body.caption = caption;
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/sendPhoto', body);
				} else if (operation === 'sendChatAction') {
					const chatId = this.getNodeParameter('chatId', i) as string;
					const action = this.getNodeParameter('action', i) as string;
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/sendChatAction', {
						chat_id: chatId,
						action,
					});
				} else if (operation === 'sendSticker') {
					const chatId = this.getNodeParameter('chatId', i) as string;
					const stickerId = this.getNodeParameter('stickerId', i) as string;
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/sendSticker', {
						chat_id: chatId,
						sticker: stickerId,
					});
				} else if (operation === 'setWebhook') {
					const webhookUrl = this.getNodeParameter('webhookUrl', i) as string;
					const secretToken = this.getNodeParameter('secretToken', i) as string;
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/setWebhook', {
						url: webhookUrl,
						secret_token: secretToken,
					});
				} else if (operation === 'deleteWebhook') {
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/deleteWebhook');
				} else if (operation === 'getWebhookInfo') {
					responseData = await apiRequest.call(this, baseUrl, 'POST', '/getWebhookInfo');
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { description: HELP_NOTICE });
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData as IDataObject),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: (error as Error).message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}
				if (error instanceof NodeOperationError || error instanceof NodeApiError) {
					throw error;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		return [returnData];
	}
}

async function apiRequest(
	this: IExecuteFunctions,
	baseUrl: string,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: Record<string, unknown>,
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		json: true,
	};

	if (body && Object.keys(body).length > 0) {
		options.body = body;
	}

	const response = await this.helpers.httpRequest(options);

	if (response && typeof response === 'object' && 'ok' in response && !response.ok) {
		const res = response as { description?: string; error?: string; error_code?: number };
		const msg = res.description ?? res.error ?? 'Unknown error';
		throw new NodeOperationError(
			this.getNode(),
			`Zalo Bot API error: ${msg}`,
			{ description: HELP_NOTICE },
		);
	}

	return response;
}
