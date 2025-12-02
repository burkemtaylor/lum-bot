import type { ApplicationCommand, GuildResolvable } from "discord.js";
import type { Command } from "../interfaces/command.ts";

// TODO: add proper type checking
/**
 * Compares two commands to see if they are the same
 * @param existingCommand the existing command
 * @param localCommand the local command
 * @returns true if the commands match, false otherwise
 */
export default function commandComparator(
  existingCommand: ApplicationCommand<{
    guild: GuildResolvable;
  }>,
  localCommand: Command
) {
  const areChoicesDifferent = (existingChoices: any[], localChoices: any[]) => {
    for (const localChoice of localChoices) {
      const existingChoice = existingChoices?.find((choice) => choice.name === localChoice.name);

      if (!existingChoice) {
        return true;
      }

      if (localChoice.value !== existingChoice.value) {
        return true;
      }
    }
    return false;
  };

  const areOptionsDifferent = (existingOptions: any[], localOptions: any[]) => {
    for (const localOption of localOptions) {
      const existingOption = existingOptions?.find((option) => option.name === localOption.name);

      if (!existingOption) {
        return true;
      }

      if (
        localOption.description !== existingOption.description ||
        localOption.type !== existingOption.type ||
        (localOption.required || false) !== existingOption.required ||
        (localOption.choices?.length || 0) !== (existingOption.choices?.length || 0) ||
        areChoicesDifferent(localOption.choices || [], existingOption.choices || [])
      ) {
        return true;
      }
    }
    return false;
  };

  if (
    existingCommand.description !== localCommand.description ||
    existingCommand.options?.length !== (localCommand.options?.length || 0) ||
    areOptionsDifferent(existingCommand.options, localCommand.options || [])
  ) {
    return false;
  }

  return true;
}
