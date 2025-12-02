import { Client, GatewayIntentBits } from "discord.js";
import { eventHandler } from "./eventHandler.ts";
import { sendErrorAlert } from "./utils/notify";

const lum = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

eventHandler(lum);

lum.on("error", (error) => {
  console.error("Discord client error:", error);
  sendErrorAlert(error, "Discord client error");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  sendErrorAlert(error, "Uncaught exception");
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error("Unhandled rejection:", error);
  sendErrorAlert(error, "Unhandled rejection");
});

lum.login(process.env.DISCORD_TOKEN);
