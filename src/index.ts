import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { addToWatchList, removeFromWatchList, listWatchList } from "./watchlist";
import { fetchRankedByCode, createRankAttachment, fetchProfileByCode, getCharacterName, createCharacterAttachments } from "./slippi";
import "dotenv/config";
import { startPolling } from "./poller";
import { registerCommandHandlers } from "./commands";

// Initialize the client for ucf disc
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Register additional command handlers from commands.ts
registerCommandHandlers(client);

client.on("error", (err) => console.error("[client error]", err));

client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === "ping") return i.reply("pong");

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

    if (i.commandName === "profile") {
        const code = i.options.getString("code", true);

        // Defer the reply to prevent timeout
        await i.deferReply();

        const profile = await fetchProfileByCode(code);
        if (!profile) {
            return i.editReply("No ranked profile found.");
        }

        const embed = new EmbedBuilder()
            .setTitle(`${code.toUpperCase()} ${profile.displayName ? `(${profile.displayName})` : ""}`)
            .setColor(0x00AE86);

        // Current season info
        embed.addFields({
            name: `📈 Current Season - ${profile.currentProfile.season || "Unknown"}`,
            value: `**${profile.currentProfile.rank}** (${Math.round(profile.currentProfile.rating * 10) / 10})\n` +
                `${profile.currentProfile.wins}W - ${profile.currentProfile.losses}L ` +
                `(${Math.round((profile.currentProfile.wins / (profile.currentProfile.wins + profile.currentProfile.losses)) * 100)}% WR)`,
            inline: false
        });

        // Top characters
        if (profile.topCharacters.length > 0) {
            const charText = profile.topCharacters
                .map((char, index) => {
                    const percentage = Math.round((char.gameCount / profile.totalGames) * 100);
                    // Use character icons as attachments, but keep medals in text since Discord doesn't support inline images in text
                    const position = index === 0 ? "1st" : index === 1 ? "2nd" : "3rd";
                    return `**${position}:** ${getCharacterName(char.character)} - ${char.gameCount} games (${percentage}%)`;
                })
                .join("\n");

            embed.addFields({
                name: `🎮 Top Characters (${profile.totalGames} total games)`,
                value: charText,
                inline: false
            });
        }

        // Past seasons
        if (profile.pastSeasons.length > 0) {
            const seasonText = profile.pastSeasons
                .slice(0, 3) // Show top 3 past seasons
                .map(season => {
                    const winrate = Math.round((season.wins / (season.wins + season.losses)) * 100);
                    return `**${season.seasonName}**: ${season.rank} (${Math.round(season.rating * 10) / 10}) - ${season.wins}W/${season.losses}L (${winrate}%)`;
                })
                .join("\n");

            embed.addFields({
                name: "🏆 Past Season Ranks",
                value: seasonText,
                inline: false
            });
        }

        embed.setTimestamp(new Date());

        // Create all attachments
        const rankAttachment = createRankAttachment(profile.currentProfile.rank ?? "");
        const characterAttachments = createCharacterAttachments(profile.topCharacters);
        
        const allAttachments = [];
        if (rankAttachment) {
            embed.setImage("attachment://rank.png");
            allAttachments.push(rankAttachment);
        }
        
        // Add character thumbnails if available
        if (characterAttachments.length > 0) {
            // You could set one as thumbnail or create a collage
            // For now, let's add the top character as thumbnail
            embed.setThumbnail(`attachment://${characterAttachments[0].name}`);
            allAttachments.push(...characterAttachments);
        }

        return i.editReply({
            embeds: [embed],
            files: allAttachments
        });
    }

    if (i.commandName === "rank") {
        const code = i.options.getString("code", true);

        // Defer the reply to prevent timeout
        await i.deferReply();

        const snap = await fetchRankedByCode(code);
        if (!snap) {
            return i.editReply("No ranked profile found.");
        }

        // Add global placement info to embed if available and in top 300
        const rankDisplay = snap.globalPlacement && snap.globalPlacement <= 300 
            ? `${snap.rank ?? "?"} (Global #${snap.globalPlacement})` 
            : `${snap.rank ?? "?"}`;

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
                    value: rankDisplay,
                    inline: true
                }
            )
            .setTimestamp(new Date());

        const rankAttachment = createRankAttachment(snap.rank ?? "");

        // Check if attachment exists before adding it
        if (rankAttachment) {
            embed.setImage("attachment://rank.png");
            return i.editReply({
                embeds: [embed],
                files: [rankAttachment]
            });
        } else {
            // Send without attachment if file doesn't exist
            console.warn(`[rank command] No rank image available for rank: ${snap.rank}`);
            return i.editReply({
                embeds: [embed]
            });
        }
    }
    if (i.commandName === "leaderboard") {
        await i.deferReply();

        const codes = listWatchList();

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