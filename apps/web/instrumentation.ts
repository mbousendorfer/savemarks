export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const workers = globalThis as typeof globalThis & {
    __savemarksWorkersStarted?: boolean;
  };
  if (workers.__savemarksWorkersStarted) return;
  workers.__savemarksWorkersStarted = true;

  const tick = async () => {
    const [{ startReadLaterEnrichment }, { startMediaSync }] =
      await Promise.all([
        import("./lib/read-later-enrichment"),
        import("./lib/media-download"),
      ]);
    await Promise.allSettled([
      startReadLaterEnrichment(50),
      startMediaSync(25),
    ]);
    const timer = setTimeout(() => void tick(), 30_000);
    timer.unref();
  };

  const timer = setTimeout(() => void tick(), 1_500);
  timer.unref();
}
