import {Client, EmbedBuilder, TextChannel} from "discord.js";
import {fetchRankedByCode, Snapshot, createRankAttachment} from "./slippi";
import {listWatchList} from "./watchlist"; // Import the correct function

const cache = new Map<string, Snapshot>(); // by connectCode

export function startPolling(client: Client, channelIdEnv = "DEFAULT_CHANNEL_ID") {
    const run = async () => {
        const allCodes = listWatchList(); // This now uses the file-based watchlist

        const channelId = process.env[channelIdEnv];
        const channel = channelId ? await client.channels.fetch(channelId) : null;

        for (const code of allCodes) {
            try {
                const fresh = await fetchRankedByCode(code);
                if (!fresh) continue;
                const prev = cache.get(code);
                const changed = !prev ||
                    prev.rating !== fresh.rating ||
                    prev.wins !== fresh.wins ||
                    prev.losses !== fresh.losses ||
                    prev.rank !== fresh.rank ||
                    prev.season !== fresh.season;

                if (changed) {
                    cache.set(code, fresh);
                    if (channel && channel.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setTitle(`${code} — ${fresh.season ?? "season ?"}`)
                            .addFields(
                                {
                                    name: "Rating",
                                    value: prev ? `${Math.round(prev.rating * 10) / 10} → ${Math.round(fresh.rating * 10) / 10}` : `${Math.round(fresh.rating * 10) / 10}`,
                                    inline: true
                                },
                                {
                                    name: "W/L",
                                    value: prev ? `${prev.wins}-${prev.losses} → ${fresh.wins}-${fresh.losses}` : `${fresh.wins}-${fresh.losses}`,
                                    inline: true
                                },
                                {name: "Rank", value: `${fresh.rank ?? "?"}`, inline: true},
                            )
                            .setTimestamp(new Date());

                        const rankAttachment = createRankAttachment(fresh.rank ?? "");
                        
                        // Only add image and attachment if file exists
                        if (rankAttachment) {
                            embed.setImage("attachment://rank.png");
                            await (channel as TextChannel).send({
                                embeds: [embed],
                                files: [rankAttachment]
                            });
                        } else {
                            // Send without image if file doesn't exist
                            console.warn(`[poller] No rank image available for rank: ${fresh.rank}`);
                            await (channel as TextChannel).send({
                                embeds: [embed]
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`[poller] Error processing code ${code}:`, error);
            }
            await sleep(750); // gentle pacing (~1.3 req/s)
        }
        setTimeout(run, 90_000 + Math.random() * 3000); // 90s cadence
    };
    run();
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));