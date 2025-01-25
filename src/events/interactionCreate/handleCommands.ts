import type { Client, Interaction } from "discord.js";
import getLocalCommands from "../../utils/getLocalCommands";
import assert from "assert";

export default async function interactionCreate(client: Client, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const localCommands = await getLocalCommands();

  try {
    const command = localCommands.find((command) => command.name === interaction.commandName);

    assert(command, "Command not found");
    assert(interaction.member, "Member is not defined");
    assert(interaction.guild, "Guild is not defined");

    if (command.devOnly) {
      if (process.env.DEV_ID !== interaction.member.user.id) {
        interaction.reply({
          content: "This is a dev-only command.",
          ephemeral: true,
        });
        return;
      }
    }

    if (command.testOnly) {
      if (interaction.guild.id !== process.env.GUILD_ID) {
        interaction.reply({
          content: "This is a test-only command.",
          ephemeral: true,
        });
        return;
      }
    }

    console.log(command.name);

    await command.default(client, interaction);
  } catch (error) {
    console.error(error);
  }
}
