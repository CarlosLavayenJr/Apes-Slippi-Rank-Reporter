import { Client, GatewayIntentBits } from "discord.js";
import { addCode, removeCode, listCodes } from "./watchStore";
import { fetchRankedByCode } from "./slippi";
import "dotenv/config";
import { startPolling } from "./poller";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });


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
        const snap = await fetchRankedByCode(code);
        return i.reply(
            snap
                ? `Season: ${snap.season}\nRating: ${snap.rating}\nW/L: ${snap.wins}-${snap.losses}\nRank: ${snap.rank}`
                : "No ranked profile found."
        );
    }
});



client.once("clientReady", () => {
    console.log(`Logged in as ${client.user?.tag}`);
    startPolling(client);
});

client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log("Login successful"))
    .catch(err => console.error("Login failed:", err));

