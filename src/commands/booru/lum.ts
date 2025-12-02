import assert from "assert";
import { randomInt } from "../../utils/random.ts";
import { type Post } from "../../interfaces/post.ts";
import { AttachmentBuilder, Client, type Interaction } from "discord.js";

export default async function lum(client: Client, interaction: Interaction) {
  assert(interaction.isChatInputCommand(), "Interaction is not a command");

  const maxPage = 35; // Genuinely just hard-coded, the API doesn't expose this info
  const page = randomInt(1, maxPage);

  const pageSize = 18; // Default page size from the site
  const index = randomInt(0, pageSize - 1);

  const response = await fetch(
    `https://www.sakugabooru.com/post.json?tags=urusei_yatsura+&page=${page}`
  );

  if (!response.ok) {
    interaction.reply("Failed to fetch image");
    return;
  }

  const body: Post[] = await response.json();

  assert(Array.isArray(body), "No images found");

  const preview: Post = body[index];

  const embed = {
    title: "lum",
    author: {
      name: "bt",
      icon_url: "https://y5w2vhen03.ufs.sh/f/fPOm9fGnm29kdV2iTG7oflIYyFOEqcSeUpgV96r0TBGnQ1Ak",
      url: "https://github.com/burkemtaylor/lum-bot",
    },
    color: 0x66cdaa,
    thumbnail: {
      url: preview.preview_url,
      height: preview.preview_height,
      width: preview.preview_width,
    },
  };

  const video = new AttachmentBuilder(preview.file_url, {
    name: "lum.mp4",
    description: "a lum video",
  });

  interaction.reply({ embeds: [embed], files: [video] });
}

export const name = "lum";
export const description = "would you like to see lum?";
export const callback = lum;
