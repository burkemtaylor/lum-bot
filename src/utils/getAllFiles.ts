import { readdir } from "node:fs/promises";
import assert from "assert";

export async function getAllFiles(dir: string, foldersOnly = false): Promise<string[]> {
  let fileNames: string[] = [];

  const files = await readdir(dir, { withFileTypes: true });

  assert(files.length > 0, "No files found");

  for (const file of files) {
    const filePath = dir + "/" + file.name;

    if (foldersOnly && file.isDirectory()) {
      fileNames.push(filePath);
    } else if (file.isFile()) {
      fileNames.push(filePath);
    }
  }

  return fileNames;
}
