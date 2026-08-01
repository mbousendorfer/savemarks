export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  setTimeout(() => {
    void import("./lib/read-later-enrichment").then(({ startReadLaterEnrichment }) =>
      startReadLaterEnrichment(50),
    );
  }, 1_500);
}
