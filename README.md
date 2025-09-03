# Slippi Ranked Reporter Discord Bot

A Discord bot that tracks and reports Slippi ranked data for Super Smash Bros. Melee players. The bot allows you to monitor player rankings, watch for changes, and display leaderboards.

## Features

**Ping/Pong** - Basic connectivity test
**Rank Lookup** - Get current ranked stats for any player**Watchlist Management** - Add/remove players to monitor
**Leaderboard** - Display ranked leaderboard of watched players
**Automatic Updates** - Polls for rank changes and posts updates

## Prerequisites

- Node.js 18 or higher
- A Discord Application and Bot Token
- Discord Server (Guild) ID where the bot will operate

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd apes-slippi-rank-reporter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the project root:
   ```env
   DISCORD_APP_ID=your_discord_application_id
   DISCORD_TOKEN=your_bot_token
   DISCORD_GUILD_ID=your_server_guild_id
   DEFAULT_CHANNEL_ID=channel_id_for_automatic_updates
   ```

4. **Register Discord slash commands**
   ```bash
   npx ts-node scripts/register-commands.ts
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

## Usage

### Development Mode
```bash
npm run dev
```
```
### Production Mode
``` bash
npm start
```
## Discord Commands
### `/ping`
Simple connectivity test - responds with "pong"
### `/rank <code>`
Get current ranked stats for a player
- **code**: Player's connect code (e.g., "ABCD#123")

### `/apebot add <code>`
Add a player to the watchlist
- **code**: Player's connect code to monitor

### `/apebot remove <code>`
Remove a player from the watchlist
- **code**: Player's connect code to stop monitoring

### `/apebot list`
Show all players currently on the watchlist
### `/leaderboard`
Display a ranked leaderboard of all watched players, sorted by rating
## Project Structure
``` 
src/
├── index.ts          # Main bot entry point
├── register-commands.ts  # Command registration script
├── slippi.ts         # Slippi API integration
├── poller.ts         # Automatic polling for updates
├── watchlist.ts      # Watchlist management
├── watchStore.ts     # Watchlist data storage
└── commands.ts       # Additional command handlers
```
## Configuration
### Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `DISCORD_APP_ID` | Discord Application ID | Yes |
| `DISCORD_TOKEN` | Discord Bot Token | Yes |
| `DISCORD_GUILD_ID` | Discord Server/Guild ID | Yes |
| `DEFAULT_CHANNEL_ID` | Channel for automatic updates | Optional |
### Polling Behavior
The bot automatically polls the Slippi API for rank changes:
- **Polling Interval**: 12-15 seconds (randomized)
- **Request Rate**: ~1.3 requests per second
- **Update Detection**: Monitors rating, wins/losses, rank, and season changes

## Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run the compiled bot |
| `npm run dev` | Run in development mode with ts-node |
## Setting Up Your Discord Bot
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token for your `.env` file
5. Go to the "General Information" section and copy the Application ID
6. Enable the bot in your server with the "applications.commands" scope

## Troubleshooting
### Command Registration Issues
If slash commands aren't appearing:
``` bash
npx ts-node register-commands.ts
```
### Bot Not Responding
- Check that your bot token is correct
- Verify the bot has proper permissions in your Discord server
- Check console logs for error messages

### API Issues
- The bot uses the Slippi GraphQL endpoint
- Rate limiting is built-in to prevent API abuse
- Check console logs for API response status
