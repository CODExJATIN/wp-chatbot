# wp-chatbot

<img src="https://cdn.simpleicons.org/whatsapp/ffffff?size=96&bg=25D366" alt="WhatsApp logo" width="96" />

Lightweight WhatsApp auto-responder that uses WhatsApp Web, Vertex AI (Gemini) and an Express control API.

Important: This repository may reference a Google service account key. Do NOT commit secrets to GitHub. See the Security section below.

## What's included
- `index.js` - main bot + Express API
- `package.json` - project metadata and scripts
- `.github/workflows/nodejs.yml` - basic CI (installs deps and runs `npm test`)

## Setup (local)
1. Install dependencies:

```powershell
npm install
```

2. Create a Google service account with Vertex AI permissions and download the JSON key. Save it as `service-account-key.json` in the project root for local testing (or use an environment variable as described below).

3. (Optional) Create a `.env` file for any environment variables and never commit it.

4. Start the bot:

```powershell
npm start
```

The bot runs an Express API on port 3000 with endpoints:
- `POST /toggle` - toggle online/offline
- `GET /status` - check current status

## Security
- The file `service-account-key.json` is already listed in `.gitignore`. Never commit it.
- For CI or production use, store the service account JSON in a GitHub Secret (or cloud secret manager). Do NOT place raw keys in the repo.

## GitHub Actions
The included workflow runs `npm ci` and `npm test`. It demonstrates how to run a basic CI job for Node.js projects. If you need the CI to access Google APIs, configure secrets and a step to write the secret to `service-account-key.json` at runtime.

## License
This project is provided under the MIT License. See `LICENSE`.
