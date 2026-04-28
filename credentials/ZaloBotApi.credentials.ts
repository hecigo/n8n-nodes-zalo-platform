import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ZaloBotApi implements ICredentialType {
	name = 'zaloBotApi';
	displayName = 'Zalo Bot API';
	documentationUrl = 'https://bot.zaloplatforms.com/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'Bot Token',
			name: 'botToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: '12345689:abc-xyz',
			description: 'Bot token received via Zalo message after creating your bot in Zalo Bot Creator. Open Zalo, search for "OA Zalo Bot Manager", select "Create Bot" to create your bot. Format: {bot_id}:{secret_key}',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '=https://bot-api.zaloplatforms.com/bot{{$credentials.botToken}}',
			url: '/getMe',
			method: 'POST',
		},
	};
}
