import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const appId  = process.env.DISCORD_APP_ID!;
const token  = process.env.DISCORD_TOKEN!;
const guildId = process.env.DISCORD_GUILD_ID!; // <- use guild route for instant install

const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("pong"),
    new SlashCommandBuilder()
        .setName("rank")
        .setDescription("fetch ranked data")
        .addStringOption(o=>o.setName("code").setDescription("ABCD#123").setRequired(true)),

    new SlashCommandBuilder()
        .setName("watch")
        .setDescription("manage watchlist")
        .addSubcommand(s => s.setName("add").setDescription("add code")
            .addStringOption(o => o.setName("code").setDescription("ABCD#123").setRequired(true)))
        .addSubcommand(s => s.setName("remove").setDescription("remove code")
            .addStringOption(o => o.setName("code").setDescription("ABCD#123").setRequired(true)))
        .addSubcommand(s => s.setName("list").setDescription("list codes"))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log("Registered guild commands");
}
main().catch(console.error);
