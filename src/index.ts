import { Client, GatewayIntentBits } from "discord.js";
import { addCode, removeCode, listCodes } from "./watchStore";
import { fetchRankedByCode } from "./slippi";
import "dotenv/config";
import { startPolling } from "./poller";
import { EmbedBuilder } from "discord.js";

console.log("[boot] NODE_ENV:", process.env.NODE_ENV);
console.log("[boot] SLIPPI_GQL_ENDPOINT:", process.env.SLIPPI_GQL_ENDPOINT || "(unset)");

process.on("unhandledRejection", (err) => {
    console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on("error", (err) => console.error("[client error]", err));

client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === "ping") return i.reply("pong");

    if (i.commandName === "watch") {
        const sub = i.options.getSubcommand();
        const gid = i.guildId!;
        if (sub === "add") {
            const code = i.options.getString("code", true);
            addCode(gid, code);
            return i.reply(`Added **${code.toUpperCase()}**`);
        }
        if (sub === "remove") {
            const code = i.options.getString("code", true);
            removeCode(gid, code);
            return i.reply(`Removed **${code.toUpperCase()}**`);
        }
        if (sub === "list") {
            const list = listCodes(gid);
            return i.reply(list.length ? list.join(", ") : "No codes yet.");
        }
    }
    if (i.commandName === "rank") {
        const code = i.options.getString("code", true);

        // Defer the reply to prevent timeout
        await i.deferReply();

        const snap = await fetchRankedByCode(code);
        return i.editReply(
            snap
                ? `**${code.toUpperCase()}**\nSeason: ${snap.season}\nRating: ${snap.rating}\nW/L: ${snap.wins}-${snap.losses}\nRank: ${snap.rank}`
                : "No ranked profile found."
        );
    }
    // Add this to your interaction handler in index.ts
    if (i.commandName === "leaderboard") {
        await i.deferReply();
        
        const gid = i.guildId!;
        const codes = listCodes(gid);
        
        if (codes.length === 0) {
            return i.editReply("No players in the watchlist. Add players with `/watch add`.");
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
                value: `Rating: ${player.rating} | W/L: ${player.wins}-${player.losses} | Winrate: ${Math.round((player.wins / (player.wins + player.losses)) * 100)}%`,
                inline: false
            });
        });
        
        return i.editReply({ embeds: [embed] });
    }
});

client.once("clientReady", () => {
    console.log(`Logged in as ${client.user?.tag}`);
    startPolling(client);
});

client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log("Login successful"))
    .catch(err => console.error("Login failed:", err));