import { spawnSync } from "node:child_process";

function succeeds(command: string, args: string[]): boolean {
  return (
    spawnSync(command, args, {
      encoding: "utf8",
      stdio: "ignore",
    }).status === 0
  );
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!succeeds("docker", ["--version"])) {
  fail(
    [
      "Docker n’est pas installé.",
      "Sur macOS, le plus simple est :",
      "  brew install --cask orbstack",
      "  open -a OrbStack",
      "Puis relance : npm run setup",
    ].join("\n"),
  );
}

if (!succeeds("docker", ["compose", "version"])) {
  fail(
    [
      "Le client Docker est installé, mais Docker Compose manque.",
      "Sur macOS, installe un environnement Docker complet :",
      "  brew install --cask orbstack",
      "  open -a OrbStack",
      "Puis relance : npm run setup",
    ].join("\n"),
  );
}

if (!succeeds("docker", ["info"])) {
  fail(
    [
      "Docker Compose est installé, mais le moteur Docker n’est pas démarré.",
      "Ouvre OrbStack ou Docker Desktop, attends qu’il soit prêt,",
      "puis relance : npm run setup",
    ].join("\n"),
  );
}

console.log("Docker Engine et Docker Compose sont prêts.");
