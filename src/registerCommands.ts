import { REST, Routes, ApplicationCommandOptionType } from 'discord.js';
import assert from 'assert';

console.log('Registering commands...');

const commands = [
  {
    name: 'ping',
    description: 'ping the bot',
  },
  {
    name: 'lum',
    description: 'want to see lum?',
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
]

assert(process.env.DISCORD_TOKEN !== undefined, 'DISCORD_TOKEN is not defined');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
(async() => {
  try {
    console.log('Started refreshing application (/) commands.');
    
    assert(process.env.CLIENT_ID !== undefined, 'CLIENT_ID is not defined');
    assert(process.env.GUILD_ID !== undefined, 'GUILD_ID is not defined'); 

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    )

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

