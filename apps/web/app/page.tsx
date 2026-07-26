"use client";

import { CheckCircleIcon, CopyIcon, LinkIcon } from "@phosphor-icons/react";
import { useState } from "react";

export default function FoundationPage() {
  const [code, setCode] = useState<string>();
  const [expiresAt, setExpiresAt] = useState<string>();
  const [error, setError] = useState<string>();

  async function createPairingCode() {
    setError(undefined);
    const response = await fetch("/api/pairing/code", { method: "POST" });
    if (!response.ok) {
      setError("Could not generate a pairing code. Check the server logs.");
      return;
    }
    const payload = (await response.json()) as {
      code: string;
      expiresAt: string;
    };
    setCode(payload.code);
    setExpiresAt(payload.expiresAt);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl bg-white p-8 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-neutral-900 p-2 text-white">
            <LinkIcon size={24} weight="bold" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">SaveMarks</h1>
            <p className="text-sm text-neutral-500">Extraction spike foundation</p>
          </div>
        </div>

        <h2 className="text-3xl font-medium tracking-tight">
          Pair the browser extension
        </h2>
        <p className="mt-3 max-w-xl leading-7 text-neutral-600">
          Generate a one-time code, then enter it in the SaveMarks extension.
          It expires after five minutes and can be used only once.
        </p>

        <div className="mt-8 min-h-24 rounded-xl bg-neutral-100 p-5">
          {code ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-3xl font-semibold tracking-[0.18em]">
                  {code}
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  Expires {new Date(expiresAt ?? "").toLocaleTimeString()}
                </p>
              </div>
              <button
                className="rounded-lg p-3 text-neutral-600 hover:bg-white"
                onClick={() => void navigator.clipboard.writeText(code)}
                aria-label="Copy pairing code"
              >
                <CopyIcon size={21} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-neutral-500">
              <CheckCircleIcon size={22} />
              No active pairing code
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button
          className="mt-6 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700"
          onClick={() => void createPairingCode()}
        >
          Generate pairing code
        </button>

        <p className="mt-10 text-xs leading-5 text-neutral-500">
          The visual library intentionally remains locked until the live X and
          Instagram extraction spike has been validated.
        </p>
      </section>
    </main>
  );
}
