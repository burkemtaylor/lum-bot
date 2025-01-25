import type { ApplicationCommandOptionData } from "discord.js";

export interface Command {
  name: string;
  default: Function;
  description: string;
  options?: ApplicationCommandOptionData[];
  callback?: Function;
  deleted?: boolean;

  devOnly?: boolean;
  testOnly?: boolean;
}
