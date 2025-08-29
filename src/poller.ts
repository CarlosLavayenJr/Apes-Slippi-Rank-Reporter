import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { fetchRankedByCode, Snapshot } from "./slippi";
import { watch, listCodes } from "./watchStore";

const cache = new Map<string, Snapshot>(); // by connectCode

export function startPolling(client: Client, channelIdEnv = "DEFAULT_CHANNEL_ID") {
    const run = async () => {
        const allCodes = new Set<string>();
        for (const gid of watch.keys()) listCodes(gid).forEach(c => allCodes.add(c));

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
                                { name: "Rating", value: prev ? `${prev.rating} → ${fresh.rating}` : `${fresh.rating}`, inline: true },
                                { name: "W/L", value: prev ? `${prev.wins}-${prev.losses} → ${fresh.wins}-${fresh.losses}` : `${fresh.wins}-${fresh.losses}`, inline: true },
                                { name: "Rank", value: `${fresh.rank ?? "?"}`, inline: true },
                            )
                            .setTimestamp(new Date());
                        await (channel as TextChannel).send({ embeds: [embed] });
                    }
                }
            } catch { /* swallow and continue */ }
            await sleep(750); // gentle pacing (~1.3 req/s)
        }
        setTimeout(run, 12_000 + Math.random()*3000); // 12–15s cadence
    };
    run();
}

const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
