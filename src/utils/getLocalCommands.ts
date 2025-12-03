import { getAllFiles } from "./getAllFiles.ts";
import path from "node:path";
import { assert } from "node:console";
import type { Command } from "../interfaces/command.ts";

export default async function getLocalCommands(): Promise<Command[]> {
  const commandCategories = await getAllFiles(path.join(__dirname, "..", "commands"), true);

  assert(commandCategories.length > 0, "No command categories found");

  return Promise.all(
    commandCategories.map(async (commandCategory) => {
      const commandCategoryName = commandCategory.replace(/\\/g, "/").split("/").pop();

      assert(commandCategoryName, "Command category name is empty");
      console.log(commandCategoryName + ": " + commandCategory);

      const commandFiles = await getAllFiles(commandCategory);

      assert(commandFiles.length > 0, "No command files found");

      return Promise.all<Command>(
        commandFiles.map(async (commandFile) => {
          const command = await import(commandFile);

          assert(command, "Command file does not exist");

          return command;
        })
      );
    })
  )
    .then((commands) => {
      return commands.flat();
    })
    .finally(() => {
      console.log("done");
    });
}
