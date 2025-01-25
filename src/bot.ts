import { Client, GatewayIntentBits } from "discord.js";
import { eventHandler } from "./eventHandler";

const lum = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

eventHandler(lum);

lum.login(process.env.DISCORD_TOKEN);
