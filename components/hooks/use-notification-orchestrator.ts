"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import React from "react";
import { useRunStore } from "@/lib/store/run-store";
import { useNotificationStore } from "@/lib/store/notification-store";
import { useSettingsStore } from "@/lib/store/settings-store";

/**
 * Watches `runs` and fires:
 *  - sonner toast for run completion
 *  - persistent notification (bell)
 *  - browser Notification when tab is hidden
 *  - audio cue (success chime / error buzz)
 *
 * The combination is gated by the user's settings (trigger: success/failure/both,
 * sound on/off, browser-push on/off).
 */
export function useNotificationOrchestrator() {
  const runs = useRunStore((s) => s.runs);
  const seenRef = useRef<Map<string, string>>(new Map());

  const trigger = useSettingsStore((s) => s.notificationTrigger);
  const browserOn = useSettingsStore((s) => s.browserNotifications);
  const soundOn = useSettingsStore((s) => s.soundNotifications);
  const addNotif = useNotificationStore((s) => s.add);

  useEffect(() => {
    for (const run of runs) {
      const last = seenRef.current.get(run.id);
      seenRef.current.set(run.id, run.status);
      if (!last || last === run.status) continue;
      if (run.status !== "success" && run.status !== "failed") continue;

      const wantsThis =
        trigger === "both" ||
        (trigger === "success" && run.status === "success") ||
        (trigger === "failure" && run.status === "failed");
      if (!wantsThis) continue;

      const title =
        run.status === "success"
          ? `Build #${run.number} passed`
          : `Build #${run.number} failed`;
      const body = `${run.repo} · ${run.branch} · ${run.commitMessage}`;

      if (run.status === "success") {
        toast.success(title, {
          description: body,
          icon: React.createElement(CheckCircle2, { className: "size-4" }),
        });
      } else {
        toast.error(title, {
          description: body,
          icon: React.createElement(XCircle, { className: "size-4" }),
        });
      }

      addNotif({
        kind: run.status === "success" ? "success" : "error",
        title,
        body,
      });

      if (browserOn && typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted" && document.hidden) {
          new Notification(title, { body, silent: !soundOn, tag: run.id });
        }
      }

      if (soundOn) playChime(run.status === "success");
    }
  }, [runs, trigger, browserOn, soundOn, addNotif]);
}

let audioCtx: AudioContext | null = null;

function playChime(success: boolean) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const tones = success ? [880, 1320] : [220, 165];
    const dur = 0.18;
    for (let i = 0; i < tones.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = tones[i];
      o.type = success ? "sine" : "sawtooth";
      g.gain.setValueAtTime(0.0001, now + i * dur);
      g.gain.exponentialRampToValueAtTime(0.18, now + i * dur + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * dur + dur);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * dur);
      o.stop(now + i * dur + dur);
    }
  } catch {
    // audio is best-effort
  }
}
