import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "SaveMarks",
  version: "0.1.0",
  description: "Privately synchronize your own X and Instagram saved posts.",
  permissions: ["storage", "alarms"],
  host_permissions: [
    "https://x.com/*",
    "https://twitter.com/*",
    "https://www.instagram.com/*",
  ],
  optional_host_permissions: ["http://*/*", "https://*/*"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "SaveMarks",
  },
  options_page: "src/options/index.html",
  content_scripts: [
    {
      matches: [
        "https://x.com/*",
        "https://twitter.com/*",
        "https://www.instagram.com/*",
      ],
      js: ["src/content/content-script.ts"],
      run_at: "document_start",
    },
    {
      matches: [
        "https://x.com/*",
        "https://twitter.com/*",
        "https://www.instagram.com/*",
      ],
      js: ["src/page/bridge.ts"],
      run_at: "document_start",
      world: "MAIN",
    },
  ],
});
