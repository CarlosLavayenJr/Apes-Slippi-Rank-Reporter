// commands.ts
import {
    Client,
    Interaction,
    ChatInputCommandInteraction,
    EmbedBuilder
} from 'discord.js';
import { addToWatchList, removeFromWatchList, listWatchList } from './watchlist';

// Export a function to register command handlers
export function registerCommandHandlers(client: Client) {
    client.on('interactionCreate', async (interaction: Interaction) => {
        if (!interaction.isCommand()) return;

        if (interaction.commandName === 'watch' &&
            interaction.isChatInputCommand()) {
            await handleWatchCommand(interaction);
        }
        // Other commands could be added here
    });
}

async function handleWatchCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'add': {
            const code = interaction.options.getString('code', true);
            const success = addToWatchList(code);

            if (success) {
                await interaction.reply(`Added **${code}** to the watch list.`);
            } else {
                await interaction.reply(`**${code}** is already in the watch list.`);
            }
            break;
        }

        case 'remove': {
            const code = interaction.options.getString('code', true);
            const success = removeFromWatchList(code);

            if (success) {
                await interaction.reply(`Removed **${code}** from the watch list.`);
            } else {
                await interaction.reply(`**${code}** was not found in the watch list.`);
            }
            break;
        }

        case 'list': {
            const players = listWatchList();

            if (players.length === 0) {
                await interaction.reply('The watch list is empty.');
            } else {
                const embed = new EmbedBuilder()
                    .setTitle('Watch List')
                    .setDescription(players.join('\n'))
                    .setColor(0x0099ff);

                await interaction.reply({ embeds: [embed] });
            }
            break;
        }
    }
}