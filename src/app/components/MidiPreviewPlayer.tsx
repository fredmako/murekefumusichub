import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import { Play, Square, Loader2, Music2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";

interface MidiPreviewPlayerProps {
  midiUrl: string;
  previewSeconds?: number;
  className?: string;
}

interface MidiNoteEvent {
  time: number;
  name: string;
  duration: number;
  velocity: number;
}

export function MidiPreviewPlayer({
  midiUrl,
  previewSeconds = 25,
  className,
}: MidiPreviewPlayerProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "playing" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(previewSeconds);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const midiRef = useRef<Midi | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part<MidiNoteEvent> | null>(null);

  const teardownPlayback = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    partRef.current?.dispose();
    synthRef.current?.dispose();
    partRef.current = null;
    synthRef.current = null;
  };

  useEffect(() => {
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
    midiRef.current = null;
    lastUrlRef.current = null;
    teardownPlayback();
    return () => {
      teardownPlayback();
    };
  }, [midiUrl]);

  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      const currentSeconds = Tone.Transport.seconds;
      const ratio = duration > 0 ? Math.min(1, currentSeconds / duration) : 0;
      setProgress(Math.round(ratio * 100));
    }, 200);
    return () => clearInterval(interval);
  }, [duration, status]);

  const stopPlayback = () => {
    teardownPlayback();
    setStatus("ready");
    setProgress(0);
  };

  const ensureMidi = async () => {
    if (midiRef.current && lastUrlRef.current === midiUrl) {
      return midiRef.current;
    }
    const midi = await Midi.fromUrl(midiUrl);
    midiRef.current = midi;
    lastUrlRef.current = midiUrl;
    return midi;
  };

  const buildPreviewEvents = (midi: Midi, previewLength: number) => {
    const notes = midi.tracks.flatMap((track) => track.notes);
    const events = notes
      .filter((note) => note.time < previewLength)
      .map((note) => ({
        time: note.time,
        name: note.name,
        duration: Math.min(note.duration, Math.max(0, previewLength - note.time)),
        velocity: note.velocity,
      }))
      .filter((event) => event.duration > 0);
    return events;
  };

  const handleTogglePlayback = async () => {
    if (!midiUrl) return;
    if (status === "playing") {
      stopPlayback();
      return;
    }

    setErrorMessage(null);
    setStatus("loading");

    try {
      await Tone.start();
      const midi = await ensureMidi();
      const previewLength = Math.max(
        8,
        Math.min(previewSeconds, midi.duration || previewSeconds),
      );
      setDuration(previewLength);

      teardownPlayback();

      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: {
          attack: 0.01,
          decay: 0.12,
          sustain: 0.3,
          release: 0.8,
        },
      }).toDestination();
      synth.volume.value = -8;

      const events = buildPreviewEvents(midi, previewLength);
      const part = new Tone.Part<MidiNoteEvent>((time, note) => {
        synth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
      }, events).start(0);

      part.loop = false;
      partRef.current = part;
      synthRef.current = synth;

      Tone.Transport.seconds = 0;
      Tone.Transport.scheduleOnce(() => {
        stopPlayback();
      }, previewLength);

      setStatus("playing");
      Tone.Transport.start("+0.05");
    } catch (error: any) {
      console.error("[midi-preview] playback failed:", error);
      teardownPlayback();
      setStatus("error");
      setErrorMessage(
        error?.message || "Unable to play this MIDI preview right now.",
      );
    }
  };

  return (
    <div
      className={`rounded-xl border border-border/70 bg-muted/35 p-3 ${className || ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Music2 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">MIDI Preview</p>
            <p className="text-xs text-muted-foreground">
              Play a {Math.round(duration)}s sample
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handleTogglePlayback()}
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading
            </>
          ) : status === "playing" ? (
            <>
              <Square className="mr-2 size-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="mr-2 size-4" />
              Play
            </>
          )}
        </Button>
      </div>
      <div className="mt-3">
        <Progress value={progress} />
      </div>
      {status === "error" && errorMessage ? (
        <p className="mt-2 text-xs text-red-500">{errorMessage}</p>
      ) : null}
    </div>
  );
}

export default MidiPreviewPlayer;
