
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { addToWatchList, removeFromWatchList, listWatchList } from "./watchlist";
import { fetchRankedByCode, createRankAttachment } from "./slippi";
import "dotenv/config";
import { startPolling } from "./poller";
import { registerCommandHandlers } from "./commands";

// Initialize the client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Register additional command handlers from commands.ts
registerCommandHandlers(client);

client.on("error", (err) => console.error("[client error]", err));

client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === "ping") return i.reply("pong");

    // Changed from "watch" to "apebot" to match registered commands
    if (i.commandName === "apebot") {
        const sub = i.options.getSubcommand();
        if (sub === "add") {
            const code = i.options.getString("code", true);
            addToWatchList(code.toUpperCase());
            return i.reply(`Added **${code.toUpperCase()}**`);
        }
        if (sub === "remove") {
            const code = i.options.getString("code", true);
            removeFromWatchList(code.toUpperCase());
            return i.reply(`Removed **${code.toUpperCase()}**`);
        }
        if (sub === "list") {
            const list = listWatchList();
            return i.reply(list.length ? list.join(", ") : "No codes yet.");
        }
    }
    if (i.commandName === "rank") {
        const code = i.options.getString("code", true);

        // Defer the reply to prevent timeout
        await i.deferReply();

        const snap = await fetchRankedByCode(code);
        if (!snap) {
            return i.editReply("No ranked profile found.");
        }

        const embed = new EmbedBuilder()
            .setTitle(`${code.toUpperCase()} — ${snap.season ?? "season ?"}`)
            .addFields(
                {
                    name: "Rating",
                    value: `${Math.round(snap.rating * 10) / 10}`,
                    inline: true
                },
                {
                    name: "W/L",
                    value: `${snap.wins}-${snap.losses}`,
                    inline: true
                },
                {
                    name: "Rank",
                    value: `${snap.rank ?? "?"}`,
                    inline: true
                }
            )
            .setImage("attachment://rank.svg")
            .setTimestamp(new Date());

        const rankAttachment = createRankAttachment(snap.rank ?? "");

        return i.editReply({
            embeds: [embed],
            files: [rankAttachment]
        });
    }
    if (i.commandName === "leaderboard") {
        await i.deferReply();

        const codes = listWatchList();

        if (codes.length === 0) {
            return i.editReply("No players in the watchlist. Add players with `/apebot add`.");
        }

        // Fetch data for all players
        const players = [];
        for (const code of codes) {
            const data = await fetchRankedByCode(code);
            if (data) {
                players.push({
                    code: code,
                    ...data
                });
            }
        }

        // Sort players by rating (highest first)
        players.sort((a, b) => b.rating - a.rating);

        // Create a formatted leaderboard message
        const embed = new EmbedBuilder()
            .setTitle("🏆 Slippi Ranked Leaderboard")
            .setDescription(`Showing ${players.length} players`)
            .setTimestamp(new Date());

        // Add fields for each player
        players.forEach((player, index) => {
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
            embed.addFields({
                name: `${medal} ${player.code} (${player.rank})`,
                value: `Rating: ${Math.round(player.rating * 10) / 10} | W/L: ${player.wins}-${player.losses} | Winrate: ${Math.round((player.wins / (player.wins + player.losses)) * 100)}%`,
                inline: false
            });
        });

        return i.editReply({ embeds: [embed] });
    }
});

// Fix the event name from "clientReady" to "ready"
client.once("ready", () => {
    console.log(`Logged in as ${client.user?.tag}`);
    startPolling(client);
});

// Add some console logs to help with debugging
console.log("[boot] NODE_ENV:", process.env.NODE_ENV);
console.log("[boot] SLIPPI_GQL_ENDPOINT:", process.env.SLIPPI_GQL_ENDPOINT || "(unset)");

// Set up error handling
process.on("unhandledRejection", (err) => {
    console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
});

// Log in with the bot token
client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log("Login successful"))
    .catch(err => console.error("Login failed:", err));