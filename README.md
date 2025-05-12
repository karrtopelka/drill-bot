# Telegram Bot with grammY and Vercel

A Telegram bot powered by [grammY](https://grammy.dev/) and deployed on [Vercel](https://vercel.com/) serverless functions.

This bot can download TikTok videos sent via links.

## Features

- TikTok video downloading
- Serverless deployment on Vercel
- TypeScript support
- Development and production environments

## Local Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```
3. Copy `.env-sample` to `.env` and add your Telegram Bot Token:
   ```
   BOT_TOKEN=your_bot_token_here
   ```
4. Run the bot in development mode:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

## Deployment to Vercel

1. Push your code to a GitHub repository

2. Create a new project on Vercel and import your repository

3. Configure environment variables in Vercel:

   - `BOT_TOKEN`: Your Telegram Bot Token

4. Deploy the project

5. Set the webhook for your bot. Replace `YOUR_BOT_TOKEN` and `YOUR_VERCEL_URL` with your actual values:
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_VERCEL_URL/api/bot
   ```

## Project Structure

- `api/bot.ts`: Main bot logic for Vercel serverless deployment
- `src/bot.ts`: Development version for local testing
- `vercel.json`: Vercel configuration

## License

MIT
