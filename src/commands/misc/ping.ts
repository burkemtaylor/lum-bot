import type { Client, Interaction } from "discord.js";
import assert from "assert";

export default async function ping(client: Client, interaction: Interaction) {
  assert(interaction.isChatInputCommand(), "Interaction is not a command");

  interaction.reply("pong! " + client.ws.ping + "ms");
}

export const name = "ping";
export const description = "ping the bot";
export const callback = ping;
