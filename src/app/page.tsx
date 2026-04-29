"use client";

import { useState, useEffect, useRef } from "react";
import { IDKitRequestWidget, selfieCheckLegacy } from "@worldcoin/idkit";
import type { IDKitResult, RpContext } from "@worldcoin/idkit";

const APP_ID = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;
const RP_ID = process.env.NEXT_PUBLIC_RP_ID as string;
const ACTION = "selfie-check";

async function fetchRpContext(action: string): Promise<RpContext> {
  const response = await fetch("/api/rp-signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch RP signature");
  }

  return {
    rp_id: RP_ID,
    nonce: data.nonce,
    created_at: data.created_at,
    expires_at: data.expires_at,
    signature: data.sig, // CRITICAL: API returns "sig", RpContext requires "signature"
  };
}

async function verifyProof(payload: IDKitResult): Promise<unknown> {
  const response = await fetch("/api/verify-proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rp_id: RP_ID, devPortalPayload: payload }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error ?? "Verification failed");
  }

  return json;
}

export default function Home() {
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [widgetRpContext, setWidgetRpContext] = useState<RpContext | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [widgetIdkitResult, setWidgetIdkitResult] = useState<IDKitResult | null>(null);
  const [verifyResponse, setVerifyResponse] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(3);
  const hasStarted = useRef(false);

  async function startWidgetFlow() {
    setWidgetError(null);
    setWidgetIdkitResult(null);
    setVerifyResponse(null);
    setIsLoading(true);
    try {
      const rpContext = await fetchRpContext(ACTION);
      setWidgetRpContext(rpContext);
      setWidgetOpen(true);
    } catch (error) {
      setWidgetError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        startWidgetFlow();
      } else {
        setCountdown(count);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full px-4">
        <h1 className="text-2xl font-semibold">Selfie Check Tester</h1>

        <button
          onClick={startWidgetFlow}
          disabled={isLoading || widgetOpen || countdown !== null}
          className="min-h-[44px] py-2 px-6 rounded-full bg-zinc-900 text-white text-sm font-semibold transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {countdown !== null
            ? `Starting in ${countdown}...`
            : isLoading
              ? "Loading..."
              : "Start Verification"}
        </button>

        {widgetIdkitResult && (() => {
          const hasOrb = JSON.stringify(verifyResponse).includes('"orb"') ||
            JSON.stringify(widgetIdkitResult).includes('"orb"');
          return (
            <div className="flex flex-col items-center gap-2">
              <p className="text-green-600 text-base">
                Success! You are Selfie Check {hasOrb ? "(and Orb)" : "(but not Orb)"} verified.
              </p>
              <p className="text-zinc-500 text-sm">
                Comments? #face-check-user-testing-feedback
              </p>
            </div>
          );
        })()}

        {widgetIdkitResult && (
          <details className="w-full text-left">
            <summary className="text-sm text-zinc-500 cursor-pointer">IDKit Response</summary>
            <pre className="mt-2 text-xs font-mono bg-zinc-100 dark:bg-zinc-900 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(widgetIdkitResult, null, 2)}
            </pre>
          </details>
        )}

        {verifyResponse !== null && (
          <details className="w-full text-left">
            <summary className="text-sm text-zinc-500 cursor-pointer">Verify API Response</summary>
            <pre className="mt-2 text-xs font-mono bg-zinc-100 dark:bg-zinc-900 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(verifyResponse, null, 2)}
            </pre>
          </details>
        )}

        {widgetError && (
          <p className="text-red-600 text-base">
            Verification failed{" "}
            <code className="font-mono text-sm">{widgetError}</code>
          </p>
        )}

        {widgetRpContext && (
          <IDKitRequestWidget
            open={widgetOpen}
            onOpenChange={setWidgetOpen}
            app_id={APP_ID}
            action={ACTION}
            rp_context={widgetRpContext}
            allow_legacy_proofs={true}
            preset={selfieCheckLegacy({ signal: "selfie-test" })}
            handleVerify={async (result) => {
              const verified = await verifyProof(result);
              setVerifyResponse(verified);
            }}
            onSuccess={(result) => {
              setWidgetIdkitResult(result);
            }}
            onError={(errorCode) => {
              setWidgetError(`Verification failed: ${errorCode}`);
            }}
          />
        )}
      </div>
    </div>
  );
}
