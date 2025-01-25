import { Client } from "discord.js";
import assert from "assert";
import getLocalCommands from "../../utils/getLocalCommands";
import getApplicationCommands from "../../utils/getApplicationCommands";
import commandComparator from "../../utils/commandComparator";

const commands = [
  {
    name: "ping",
    description: "ping the bot",
  },
  {
    name: "lum",
    description: "want to see lum?",
  },
  //{
  //  name: 'sakugabooru',
  //  description: 'search sakugabooru',
  //  options: [
  //    {
  //      name: 'tags',
  //      description: 'search tags',
  //      type: ApplicationCommandOptionType.String,
  //      required: true,
  //    }
  //  ],
  //}
];

export default async function registerCommands(client: Client) {
  console.log("Registering commands...");
  assert(process.env.DISCORD_TOKEN !== undefined, "DISCORD_TOKEN is not defined");

  try {
    console.log("Started refreshing application (/) commands.");

    assert(process.env.CLIENT_ID !== undefined, "CLIENT_ID is not defined");
    assert(process.env.GUILD_ID !== undefined, "GUILD_ID is not defined");

    const localCommands = await getLocalCommands();
    const currentAppCommands = await getApplicationCommands(client, process.env.GUILD_ID);

    assert(localCommands.length > 0, "No local commands found");

    localCommands.forEach(async (command) => {
      const { name, description, options } = command;
      console.log(name);

      const existingCommand = currentAppCommands.cache.find((c) => c.name === name);

      if (existingCommand) {
        if (command.deleted) {
          currentAppCommands.delete(existingCommand.id);
        } else {
          if (!commandComparator(existingCommand, command)) {
            await currentAppCommands.edit(existingCommand.id, {
              description,
              options,
            });
          }
        }
      } else {
        if (!command.deleted) {
          await currentAppCommands.create({
            name,
            description,
            options,
          });
        }
      }
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}
