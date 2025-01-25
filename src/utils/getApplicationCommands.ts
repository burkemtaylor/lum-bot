import type { Client } from "discord.js";
import assert from "assert";

export default async function getApplicationCommands(client: Client, guildId: string) {
  let commands;

  if (guildId) {
    const guild = await client.guilds.fetch(guildId);
    commands = await guild.commands;
  } else {
    assert(client.application, "Client is not a bot");

    commands = client.application.commands;
  }

  return commands;
}
