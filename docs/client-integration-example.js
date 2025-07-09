// Client-side error handling example for your Vue.js app

class LifxApiClient {
	constructor(backendUrl) {
		this.backendUrl = backendUrl;
		this.sessionId = this.generateSessionId();
		this.isServerOnline = true;
	}

	generateSessionId() {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	async checkServerHealth() {
		try {
			const response = await fetch(`${this.backendUrl}/health`, {
				method: 'GET',
				timeout: 5000, // 5 second timeout
			});

			if (response.ok) {
				this.isServerOnline = true;
				return true;
			} else {
				this.isServerOnline = false;
				return false;
			}
		} catch (error) {
			this.isServerOnline = false;
			console.warn('Backend server appears to be offline:', error.message);
			return false;
		}
	}

	async callClaude(claudeApiKey, lifxApiKey, message, options = {}) {
		// First check if server is reachable
		const serverOnline = await this.checkServerHealth();

		if (!serverOnline) {
			throw new Error(
				'Backend server is currently unavailable. Please try again later.'
			);
		}

		try {
			const response = await fetch(`${this.backendUrl}/api/claude`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-demo-key': 'LifxDemo2024',
					'x-session-id': this.sessionId,
				},
				body: JSON.stringify({
					claudeApiKey,
					lifxApiKey,
					message,
					// System prompt mode: true = LIFX-only, false = general + LIFX-aware
					// Both modes always include LIFX capabilities, just different conversation scope
					systemPromptEnabled: options.systemPromptEnabled ?? true,
					maxTokens: options.maxTokens ?? 1000,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `Server error: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			if (error.name === 'TypeError' && error.message.includes('fetch')) {
				throw new Error(
					'Cannot connect to backend server. Please check your internet connection.'
				);
			}
			throw error;
		}
	}

	async controlLights(lifxApiKey, action, params = {}) {
		const serverOnline = await this.checkServerHealth();

		if (!serverOnline) {
			throw new Error(
				'Backend server is currently unavailable. Please try again later.'
			);
		}

		try {
			const response = await fetch(`${this.backendUrl}/api/lifx/${action}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-demo-key': 'LifxDemo2024',
					'x-session-id': this.sessionId,
				},
				body: JSON.stringify({
					lifxApiKey,
					...params,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `Server error: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			if (error.name === 'TypeError' && error.message.includes('fetch')) {
				throw new Error(
					'Cannot connect to backend server. Please check your internet connection.'
				);
			}
			throw error;
		}
	}
}

// Usage in your Vue.js component:
export default {
	data() {
		return {
			apiClient: new LifxApiClient('https://your-app-name.railway.app'),
			claudeApiKey: '',
			lifxApiKey: '',
			serverStatus: 'checking', // 'online', 'offline', 'checking'
			errorMessage: '',
			isLoading: false,
		};
	},

	async mounted() {
		await this.checkServerStatus();
	},

	methods: {
		async checkServerStatus() {
			this.serverStatus = 'checking';
			const isOnline = await this.apiClient.checkServerHealth();
			this.serverStatus = isOnline ? 'online' : 'offline';
		},

		async sendMessage(message) {
			if (this.serverStatus !== 'online') {
				this.errorMessage =
					'Backend server is not available. Please try again later.';
				return;
			}

			if (!this.claudeApiKey || !this.lifxApiKey) {
				this.errorMessage =
					'Please enter both your Claude API key and LIFX API key.';
				return;
			}

			this.isLoading = true;
			this.errorMessage = '';

			try {
				const response = await this.apiClient.callClaude(
					this.claudeApiKey,
					this.lifxApiKey,
					message
				);

				// Handle successful response
				console.log('Claude response:', response);
			} catch (error) {
				this.errorMessage = error.message;

				// If it's a rate limit error, show specific message
				if (error.message.includes('rate limit')) {
					this.errorMessage =
						'Rate limit exceeded. Please wait a moment before trying again.';
				}
			} finally {
				this.isLoading = false;
			}
		},
	},
};
