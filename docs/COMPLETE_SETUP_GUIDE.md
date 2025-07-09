# 🚀 Complete Setup Guide for LIFX-Claude Client-Server App

## Overview

This guide will help you deploy your backend server to Railway and connect it with your frontend on GitHub Pages. **No experience with client-server apps required!**

## 📋 Prerequisites

- Claude API key (from Anthropic)
- LIFX API token (from LIFX Cloud)
- GitHub account
- Your Vue.js frontend already on GitHub Pages

---

## 🎯 Step 1: Prepare Your Backend Code

### 1.1 Initialize Git Repository

```bash
cd /Users/forresthorner/Dev/Vuejs3/LifxMCPServerBackend

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial LIFX MCP Server Backend"

# Set main branch
git branch -M main
```

### 1.2 Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click "New repository"
3. Name it: `LifxMCPServerBackend`
4. Make it **Public** (Railway free tier requires public repos)
5. Don't initialize with README (you already have files)
6. Click "Create repository"

### 1.3 Push to GitHub

```bash
# Add remote origin (replace 'tenace2' with your username if different)
git remote add origin https://github.com/tenace2/LifxMCPServerBackend.git

# Push to GitHub
git push -u origin main
```

---

## ☁️ Step 2: Deploy to Railway

### 2.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Login"
3. Choose "Login with GitHub"
4. Authorize Railway to access your GitHub account

### 2.2 Deploy Your Project

1. **Create New Project:**

   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Find and select `LifxMCPServerBackend`
   - Click "Deploy Now"

2. **Railway Auto-Detection:**
   - Railway will automatically detect it's a Node.js project
   - It will install dependencies and start the server
   - Initial deployment takes 2-3 minutes

### 2.3 Configure Environment Variables

1. **Go to Project Settings:**

   - Click on your deployed project
   - Go to "Variables" tab
   - Add these environment variables:

   ```
   NODE_ENV=production
   DEMO_ACCESS_KEY=LifxDemo2024
   LOG_LEVEL=info
   ALLOWED_ORIGINS=https://tenace2.github.io
   PORT=3001
   ```

2. **Save and Redeploy:**
   - Railway will automatically redeploy with new variables
   - Wait for deployment to complete (green status)

### 2.4 Get Your Backend URL

- In Railway dashboard, you'll see a URL like:
  `https://lifxmcpserverbackend-production-xxxx.railway.app`
- **Write this down!** You'll need it for your frontend.

---

## 🔗 Step 3: Update Your Frontend

### 3.1 Update Your Vue.js App

In your frontend code, update the API endpoint:

```javascript
// Replace 'YOUR_RAILWAY_URL' with your actual Railway URL
const API_BASE_URL = 'https://lifxmcpserverbackend-production-xxxx.railway.app';

// Example API call function
async function callClaudeAPI(claudeKey, lifxKey, message) {
	const sessionId = `session_${Date.now()}_${Math.random()
		.toString(36)
		.substr(2, 9)}`;

	try {
		const response = await fetch(`${API_BASE_URL}/api/claude`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-demo-key': 'LifxDemo2024',
				'x-session-id': sessionId,
			},
			body: JSON.stringify({
				claudeApiKey: claudeKey,
				lifxApiKey: lifxKey,
				message: message,
				systemPromptEnabled: true,
				maxTokens: 1000,
			}),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'API call failed');
		}

		return await response.json();
	} catch (error) {
		console.error('API Error:', error);
		throw error;
	}
}
```

### 3.2 Add User Input Fields

Add these input fields to your Vue.js component:

```html
<template>
	<div class="api-keys-section">
		<h3>API Configuration</h3>

		<div class="input-group">
			<label for="claude-key">Claude API Key:</label>
			<input
				id="claude-key"
				type="password"
				v-model="claudeApiKey"
				placeholder="sk-ant-..."
				class="api-key-input"
			/>
			<small
				>Get your key from:
				<a href="https://console.anthropic.com/" target="_blank"
					>Anthropic Console</a
				></small
			>
		</div>

		<div class="input-group">
			<label for="lifx-key">LIFX API Token:</label>
			<input
				id="lifx-key"
				type="password"
				v-model="lifxApiKey"
				placeholder="Your LIFX token..."
				class="api-key-input"
			/>
			<small
				>Get your token from:
				<a href="https://cloud.lifx.com/settings" target="_blank"
					>LIFX Cloud</a
				></small
			>
		</div>

		<div class="server-status">
			<span :class="['status-indicator', serverStatus]"></span>
			Backend Server: {{ serverStatusText }}
		</div>
	</div>
</template>

<script>
	export default {
		data() {
			return {
				claudeApiKey: '',
				lifxApiKey: '',
				serverStatus: 'checking', // 'online', 'offline', 'checking'
			};
		},

		computed: {
			serverStatusText() {
				switch (this.serverStatus) {
					case 'online':
						return 'Online ✅';
					case 'offline':
						return 'Offline ❌';
					case 'checking':
						return 'Checking...';
					default:
						return 'Unknown';
				}
			},
		},

		async mounted() {
			await this.checkServerStatus();
		},

		methods: {
			async checkServerStatus() {
				try {
					const response = await fetch(`${API_BASE_URL}/health`);
					this.serverStatus = response.ok ? 'online' : 'offline';
				} catch (error) {
					this.serverStatus = 'offline';
				}
			},
		},
	};
</script>

<style>
	.api-keys-section {
		background: #f5f5f5;
		padding: 20px;
		border-radius: 8px;
		margin: 20px 0;
	}

	.input-group {
		margin-bottom: 15px;
	}

	.input-group label {
		display: block;
		margin-bottom: 5px;
		font-weight: bold;
	}

	.api-key-input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.input-group small {
		display: block;
		margin-top: 5px;
		color: #666;
	}

	.server-status {
		margin-top: 15px;
		padding: 10px;
		background: white;
		border-radius: 4px;
	}

	.status-indicator {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: 8px;
	}

	.status-indicator.online {
		background-color: #4caf50;
	}
	.status-indicator.offline {
		background-color: #f44336;
	}
	.status-indicator.checking {
		background-color: #ff9800;
	}
</style>
```

---

## 🧪 Step 4: Test Everything

### 4.1 Test Backend Health

Visit your Railway URL + `/health`:

```
https://your-railway-url.railway.app/health
```

Should return: `{"status":"healthy",...}`

### 4.2 Test API Info

Visit your Railway URL + `/api/info`:

```
https://your-railway-url.railway.app/api/info
```

Should return API documentation.

### 4.3 Test From Frontend

1. Open your GitHub Pages site
2. Enter your Claude API key and LIFX token
3. Try sending a message like "Turn on all lights"
4. Check browser console for any errors

---

## 🚨 Common Issues & Solutions

### Railway Deployment Failed

- **Issue:** Build errors
- **Solution:** Check Railway logs, ensure `package.json` is correct

### CORS Errors in Browser

- **Issue:** Frontend can't access backend
- **Solution:** Verify `ALLOWED_ORIGINS` includes your exact GitHub Pages URL

### "Demo access key required"

- **Issue:** Missing authentication header
- **Solution:** Ensure you're sending `x-demo-key: LifxDemo2024` header

### Server Shows "Offline"

- **Issue:** Railway app might be sleeping (free tier)
- **Solution:** Visit the Railway URL directly to wake it up

### Rate Limits

- **Issue:** Too many requests
- **Solution:** Wait 1 minute, or implement request queuing in frontend

---

## 🔧 Railway Management

### Viewing Logs

1. Go to Railway dashboard
2. Click your project
3. Go to "Deployments" tab
4. Click "View Logs" for real-time monitoring

### Redeploying

- Push new code to GitHub → Railway auto-deploys
- Or click "Redeploy" in Railway dashboard

### Scaling (If Needed)

- Free tier: Generous limits for demo usage
- Paid tier: $5/month for more resources

---

## 💡 Best Practices

### Security

- ✅ API keys entered by users (not stored on server)
- ✅ Rate limiting prevents abuse
- ✅ CORS restricts access to your domain only
- ✅ Input validation on all requests

### Error Handling

- Always check server status before API calls
- Show user-friendly error messages
- Implement retry logic for network issues
- Handle rate limits gracefully

### Performance

- Cache server status checks
- Implement loading states
- Show progress for long operations

---

## 📞 Getting Help

If you run into issues:

1. **Check Railway Logs:**

   - Railway Dashboard → Your Project → Deployments → View Logs

2. **Test Backend Directly:**

   - Try: `https://your-url.railway.app/health`

3. **Check Browser Console:**

   - F12 → Console tab for frontend errors

4. **Common Error Codes:**
   - `401`: Missing or wrong demo key
   - `400`: Invalid request format
   - `429`: Rate limited
   - `500`: Server error (check Railway logs)

---

## 🎉 You're Ready!

Once this is all set up:

- Your backend runs 24/7 on Railway (free tier)
- Users enter their own API keys securely
- Your frontend communicates with the backend seamlessly
- LIFX lights respond to Claude AI commands!

**Total cost: $0** (using free tiers of Railway and GitHub Pages)

The setup might seem complex, but once it's done, you have a professional client-server architecture that scales and works reliably!
