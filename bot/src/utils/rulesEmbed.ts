import fs from "fs";
import crypto from "crypto";
import path from "node:path";
import { EmbedBuilder, TextBasedChannel } from "discord.js";

const RULES_PATH = process.env.RULES_FILE || "./src/data/rules.txt";
const STATE_DIR = process.env.BOT_STATE_DIR || "./src/data";
const HASH_PATH = path.join(STATE_DIR, "hash.txt");
const DATA_PATH = path.join(STATE_DIR, "rulesMessage.json");

interface RulesData {
  channelId: string;
  messageId?: string;
}

// Load rules from file
export function loadRules(): string {
  return fs.readFileSync(RULES_PATH, "utf8");
}

// Generate hash
export function getHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Read stored hash
export function readHash(): string | null {
  if (!fs.existsSync(HASH_PATH)) return null;
  return fs.readFileSync(HASH_PATH, "utf8");
}

// Write hash
export function writeHash(hash: string): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(HASH_PATH, hash);
}

// Load rules.json
export function loadData(): RulesData {
  const source = fs.existsSync(DATA_PATH) ? DATA_PATH : "./src/data/rulesMessage.json";
  return JSON.parse(fs.readFileSync(source, "utf8"));
}

// Save rules.json
export function saveData(data: RulesData): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Build embed
export function buildRulesEmbed(rules: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📜 Server Rules")
    .setDescription(rules)
    .setColor(0xffb81c)
    .setFooter({ text: `Last updated` })
    .setTimestamp();
}

// Main updater
export async function updateRulesMessage(channel: TextBasedChannel) {
  const rules = loadRules();
  const newHash = getHash(rules);
  const oldHash = readHash();

  const data = loadData();

  let message;

  try {
    if (data.messageId) {
      message = await channel.messages.fetch(data.messageId);
    }
  } catch {
    message = null;
  }

  if (!channel.isSendable()) return;

  // If no message exists → create one
  if (!message) {
    const msg = await channel.send({
      embeds: [buildRulesEmbed(rules)],
    });

    data.messageId = msg.id;
    saveData(data);
    writeHash(newHash);

    console.log("Created new rules message.");
    return;
  }

  // If changed → update
  if (oldHash !== newHash) {
    await message.edit({
      embeds: [buildRulesEmbed(rules)],
    });

    writeHash(newHash);
    console.log("Updated rules message.");
  } else {
    console.log("Rules unchanged.");
  }
}
