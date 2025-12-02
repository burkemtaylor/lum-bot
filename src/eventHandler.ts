import { Client } from "discord.js";
import path from "node:path";
import { getAllFiles } from "./utils/getAllFiles.ts";
import assert from "node:assert";

export async function eventHandler(client: Client) {
  const eventFolders = await getAllFiles(path.join(__dirname, "..", "src/events"), true);
  assert(eventFolders.length > 0, "No event folders found");

  eventFolders.forEach(async (eventFolder) => {
    const eventName = eventFolder.replace(/\\/g, "/").split("/").pop();
    const eventFiles = await getAllFiles(eventFolder);

    assert(eventName, "Event folder name is empty");

    console.log(eventName + ": " + eventFiles.length + " event files found");

    client.on(eventName, async (args) => {
      eventFiles.forEach(async (eventFile) => {
        console.log(eventFile);
        const event = await import(eventFile);

        assert(event, "Event file does not exist");
        assert(event.default, "Event file does not export a default function");

        await event.default(client, args);
      });
    });
  });
}
