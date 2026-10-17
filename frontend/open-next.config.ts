import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR or persistent incremental cache is used by this website.
export default defineCloudflareConfig();
