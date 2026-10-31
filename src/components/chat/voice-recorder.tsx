"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 60;

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type VoiceRecorderProps = {
  disabled?: boolean;
  onAudio: (blob: Blob, mimeType: string) => Promise<void> | void;
  onError: (message: string) => void;
};

export function VoiceRecorder({
  disabled,
  onAudio,
  onError,
}: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "processing">(
    "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const autoStopRef = useRef(false);
  const onAudioRef = useRef(onAudio);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onAudioRef.current = onAudio;
    onErrorRef.current = onError;
  }, [onAudio, onError]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setSeconds(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(
    (cancel: boolean) => {
      cancelledRef.current = cancel;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    },
    [],
  );

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current(
        "Este navegador no permite grabar audio. Escribe el mensaje.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;
      autoStopRef.current = false;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const wasCancelled = cancelledRef.current;
        cleanup();
        if (wasCancelled) {
          setState("idle");
          return;
        }
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size === 0) {
          setState("idle");
          onErrorRef.current("La grabación quedó vacía. Intenta de nuevo.");
          return;
        }
        setState("processing");
        try {
          await onAudioRef.current(blob, type);
        } finally {
          setState("idle");
        }
      };

      recorder.onerror = () => {
        cleanup();
        setState("idle");
        onErrorRef.current("No se pudo grabar el audio. Intenta de nuevo.");
      };

      recorder.start(250);
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_SECONDS && !autoStopRef.current) {
            autoStopRef.current = true;
            stop(false);
          }
          return Math.min(next, MAX_SECONDS);
        });
      }, 1000);
    } catch {
      cleanup();
      setState("idle");
      onErrorRef.current(
        "No se pudo acceder al micrófono. Revisa los permisos del navegador.",
      );
    }
  }, [cleanup, stop]);

  const busy = state !== "idle";
  const remaining = Math.max(MAX_SECONDS - seconds, 0);

  return (
    <div className="flex items-center gap-2">
      {state === "idle" && (
        <button
          type="button"
          className="btn btn-outline-brand"
          onClick={() => void start()}
          disabled={disabled}
          aria-label="Grabar mensaje de voz"
        >
          <i className="bi bi-mic" aria-hidden="true" />
        </button>
      )}

      {state === "recording" && (
        <>
          <span
            className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm text-red-700"
            role="status"
            aria-live="polite"
          >
            <span className="recording-dot" aria-hidden="true" />
            {formatSeconds(seconds)} · quedan {remaining} s
          </span>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => stop(false)}
            aria-label="Detener y enviar grabación"
          >
            <i className="bi bi-stop-fill me-1" aria-hidden="true" />
            Detener
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => stop(true)}
            aria-label="Cancelar grabación"
          >
            Cancelar
          </button>
        </>
      )}

      {state === "processing" && (
        <span
          className="flex items-center gap-2 text-sm text-[var(--muted)]"
          role="status"
        >
          <span
            className="spinner-border spinner-border-sm"
            aria-hidden="true"
          />
          Transcribiendo…
        </span>
      )}

      {busy && disabled && state === "recording" && (
        <span className="sr-only">El envío está bloqueado temporalmente.</span>
      )}
    </div>
  );
}
