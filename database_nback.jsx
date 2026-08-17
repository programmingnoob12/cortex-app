import { useState, useRef, useCallback, useEffect, useMemo, Fragment, Component } from "react";
import * as THREE from "three";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// PRODUCTION BACKEND — Supabase (Postgres + Auth + Row-Level Security)
// ---------------------------------------------------------------------
// Fill these in from your Supabase project settings (Project Settings ->
// API). The anon key is safe to ship client-side — it can only do what
// your Row-Level Security policies (see schema.sql) allow it to do, which
// is: a logged-in user may read/write rows where user_id = their own auth
// uid, and nothing else. Nobody's data is reachable from anybody else's
// session even though this key is public.
const SUPABASE_URL = "https://sdvfacmhljkwojvmtflr.supabase.co"; // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_oeUIhMq6Wg9ElS6gCzbIZw_djTvdsLm";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------
// SUPABASE-BACKED STORAGE ADAPTER
// ---------------------------------------------------------------------
// The entire app below (80+ call sites) already talks to a single
// consistent interface: window.storage.get/set/delete(key, shared) ->
// { key, value, shared } | null. Rather than touch every call site, this
// builds a real object with that exact same shape, backed by a Postgres
// table (see schema.sql: user_kv) instead of the browser. Once a user
// signs in, AuthGate below points window.storage at an instance of this
// scoped to their user id — every existing get/set/delete call in the app
// keeps working unmodified, but now reads/writes their row in Postgres
// instead of local browser storage, so it survives cleared history and
// follows them across devices.
function makeSupabaseStorage(userId) {
  return {
    async get(key, shared = false) {
      const { data, error } = await supabase
        .from("user_kv")
        .select("value")
        .eq(shared ? "shared" : "user_id", shared ? true : userId)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { key, value: data.value, shared };
    },
    async set(key, value, shared = false) {
      const row = shared
        ? { key, value, shared: true, user_id: userId }
        : { key, value, shared: false, user_id: userId };
      const { error } = await supabase
        .from("user_kv")
        .upsert(row, { onConflict: shared ? "key,shared" : "user_id,key,shared" });
      if (error) throw error;
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      const { error } = await supabase
        .from("user_kv")
        .delete()
        .eq(shared ? "shared" : "user_id", shared ? true : userId)
        .eq("key", key);
      if (error) throw error;
      return { key, deleted: true, shared };
    },
    async list(prefix = "", shared = false) {
      let query = supabase
        .from("user_kv")
        .select("key")
        .eq(shared ? "shared" : "user_id", shared ? true : userId);
      if (prefix) query = query.like("key", `${prefix}%`);
      const { data, error } = await query;
      if (error) throw error;
      return { keys: (data || []).map((r) => r.key), prefix, shared };
    },
  };
}

// ---------------------------------------------------------------------
// AUTH GATE — magic-link login, no passwords
// ---------------------------------------------------------------------
// Nothing below renders until Supabase confirms a signed-in session. Flow:
// person enters their email -> Supabase sends a one-time login link ->
// clicking it returns them here already authenticated -> window.storage
// is swapped to the Supabase-backed adapter above, scoped to their user id
// -> the real app renders. membership_status is checked so someone with
// an account but no completed payment (shouldn't normally happen, since
// accounts are only created by the Stripe webhook after payment) can't
// slip through.
function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [membershipOk, setMembershipOk] = useState(null); // null = checking, true/false once known

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setMembershipOk(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("membership_status")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setMembershipOk(false);
        return;
      }
      setMembershipOk(data?.membership_status === "active");
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (session?.user && membershipOk) {
      window.storage = makeSupabaseStorage(session.user.id);
    }
  }, [session, membershipOk]);

  const handleSendLink = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setLinkSent(true);
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-5">
          <h1 className="text-2xl font-semibold text-center">Sign in</h1>
          {linkSent ? (
            <p className="text-slate-300 text-center text-base">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </p>
          ) : (
            <form onSubmit={handleSendLink} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                className="w-full bg-indigo-500 hover:bg-indigo-400 transition-colors rounded-lg py-3 text-base font-medium"
              >
                Send sign-in link
              </button>
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
            </form>
          )}
        </div>
      </div>
    );
  }

  if (membershipOk === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Checking membership…</div>
      </div>
    );
  }

  if (!membershipOk) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-3 text-center">
          <h1 className="text-xl font-semibold">No active membership found</h1>
          <p className="text-slate-400 text-base">
            This account isn't linked to an active membership. If you just paid, this can take a
            minute to sync — try refreshing.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

// ---------------------------------------------------------------------
// Error/failure visibility — previously a failed window.storage write
// (quota, corrupted JSON, storage unavailable) or a thrown render error
// was completely invisible: the .catch(() => {}) pattern used everywhere
// swallowed it, and there was no error boundary, so a regression like RRT
// silently never saving only ever surfaced from a user report. This gives
// every storage write and every thrown error somewhere to land — a capped,
// persisted log the person can actually see under Account → Diagnostics —
// instead of failing silently.
// ---------------------------------------------------------------------
const ERROR_LOG_KEY = "_error-log";
const MAX_ERROR_LOG_ENTRIES = 50;

// Deliberately does NOT go through safeStorageSet below — that would let a
// failing error-log write try to log itself and loop. Reads-then-writes
// the log directly, swallowing (but console.error-ing) any failure of the
// logging itself, since logging is best-effort by nature.
function logClientError(context, error) {
  const message = (error && error.message) || String(error ?? "unknown error");
  const entry = { ts: Date.now(), context, message: message.slice(0, 300) };
  // eslint-disable-next-line no-console
  console.error(`[nback] ${context}:`, error);
  if (typeof window === "undefined" || !window.storage) return;
  window.storage
    .get(ERROR_LOG_KEY, false)
    .catch(() => null)
    .then((res) => {
      let existing = [];
      try {
        existing = res && res.value ? JSON.parse(res.value) : [];
      } catch (e) {
        existing = [];
      }
      const next = [...existing, entry].slice(-MAX_ERROR_LOG_ENTRIES);
      safeStorageSet(ERROR_LOG_KEY, JSON.stringify(next), false);
    })
    .catch(() => {});
}

// Drop-in replacement for `window.storage.set(...).catch(() => {})` — same
// fire-and-forget usage, but a failure gets logged instead of vanishing.
function safeStorageSet(key, value, shared) {
  if (typeof window === "undefined" || !window.storage) return Promise.resolve(null);
  return window.storage.set(key, value, shared).catch((err) => {
    logClientError(`storage write failed: ${key}`, err);
    return null;
  });
}

// Same idea for `window.storage.delete(...).catch(() => {})`.
function safeStorageDelete(key, shared) {
  if (typeof window === "undefined" || !window.storage) return Promise.resolve(null);
  return window.storage.delete(key, shared).catch((err) => {
    logClientError(`storage delete failed: ${key}`, err);
    return null;
  });
}

// Catches thrown render errors that would otherwise take down the entire
// app with a blank screen — logs them the same way as everything else and
// shows a small recoverable fallback instead.
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    logClientError(`render error: ${info?.componentStack?.split("\n")[1]?.trim() || "unknown component"}`, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-5 text-center">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-slate-400 text-base">
              The app hit an unexpected error. It's been logged — reloading
              should get you back to where you were.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-4 text-lg font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LETTERS = ["A", "K", "L", "Z", "R", "O", "G", "Q", "S", "F", "Y"];
const SHAPE_TYPES = ["square", "triangle", "star", "circle", "diamond", "hexagon"];
const COLORS = ["#3b82f6", "#eab308", "#f97316", "#22c55e", "#a855f7", "#ef4444"];
const GRID_SIZE = 9; // 3x3 grid, positions 0-8
const POSITIONS = Array.from({ length: GRID_SIZE }, (_, i) => i);

const ISI_MS = 500;

function trialsForLevel(nLevel) {
  return nLevel * 9; // 1->9, 2->18, 3->27, 4->36, ...
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} sec`;
  return `${minutes} min ${seconds} sec`;
}

function formatHours(ms) {
  const hours = ms / 3600000;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
}

// Relative "time ago" label for the QNB' test harness's Recent Games table —
// mirrors the reference log's "4 days ago" style.
function timeAgo(ts) {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Color-codes a modality accuracy % the same rough way the reference log
// does — red for weak, amber/lime in the middle, green for strong.
function accuracyBadgeClass(pct) {
  if (pct < 25) return "bg-red-500/20 text-red-300";
  if (pct < 50) return "bg-amber-500/20 text-amber-300";
  if (pct < 75) return "bg-lime-500/20 text-lime-300";
  return "bg-emerald-500/20 text-emerald-300";
}

// Whether the person has broken a streak at some point and come back to
// training since — a rough heuristic: any gap of 2+ days between two
// training days somewhere in their history, and they're currently active.
function hasComebackFromBrokenStreak(exerciseHistory) {
  const days = new Set();
  Object.values(exerciseHistory).forEach((hist) => {
    (hist || []).forEach((h) => days.add(new Date(h.ts).toDateString()));
  });
  const sorted = Array.from(days)
    .map((d) => new Date(d))
    .sort((a, b) => a - b);
  if (sorted.length < 2) return false;
  const hadGap = sorted.some((d, i) => {
    if (i === 0) return false;
    const diffDays = Math.round((d - sorted[i - 1]) / 86400000);
    return diffDays > 1;
  });
  return hadGap && currentStreakDays(exerciseHistory) >= 1;
}

const MODALITY_META = {
  pos: { label: "Position" },
  audio: { label: "Sound" },
  shape: { label: "Shape" },
  color: { label: "Color" },
};
const BUTTON_BASE = "bg-slate-700 hover:bg-slate-600";
const BUTTON_PULSE = "bg-emerald-500";

// A visual identity color per exercise, used for card borders/tints,
// leaderboard tab highlights, and header accents so each exercise reads as
// its own thing rather than everything sharing one flat indigo.
const ACCENT_STYLES = {
  indigo: {
    border: "border-indigo-500/40",
    borderStrong: "border-indigo-400",
    hoverBorderStrong: "hover:border-indigo-400",
    bg: "bg-indigo-500/10",
    text: "text-indigo-300",
    dot: "bg-indigo-400",
    grad: "from-indigo-500 to-violet-500",
  },
  violet: {
    border: "border-violet-500/40",
    borderStrong: "border-violet-400",
    hoverBorderStrong: "hover:border-violet-400",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
    dot: "bg-violet-400",
    grad: "from-violet-500 to-fuchsia-500",
  },
  amber: {
    border: "border-amber-500/40",
    borderStrong: "border-amber-400",
    hoverBorderStrong: "hover:border-amber-400",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    dot: "bg-amber-400",
    grad: "from-amber-500 to-orange-500",
  },
  cyan: {
    border: "border-cyan-500/40",
    borderStrong: "border-cyan-400",
    hoverBorderStrong: "hover:border-cyan-400",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    dot: "bg-cyan-400",
    grad: "from-cyan-500 to-sky-500",
  },
  rose: {
    border: "border-rose-500/40",
    borderStrong: "border-rose-400",
    hoverBorderStrong: "hover:border-rose-400",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    dot: "bg-rose-400",
    grad: "from-rose-500 to-pink-500",
  },
  lime: {
    border: "border-lime-500/40",
    borderStrong: "border-lime-400",
    hoverBorderStrong: "hover:border-lime-400",
    bg: "bg-lime-500/10",
    text: "text-lime-300",
    dot: "bg-lime-400",
    grad: "from-lime-500 to-lime-400",
  },
  emerald: {
    border: "border-emerald-500/40",
    borderStrong: "border-emerald-400",
    hoverBorderStrong: "hover:border-emerald-400",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    grad: "from-emerald-500 to-teal-500",
  },
};

// Base metadata for every exercise. Session durations are NOT baked in here —
// they come from whichever regime the person picks (the same exercise can run
// for different lengths depending on the regime), except the currently-built
// games (dual, quad) don't have a "coming soon" flag.
const EXERCISE_LIBRARY = {
  dual: {
    key: "dual",
    title: "Dual N-Back",
    abbrev: "D",
    accent: "indigo",
    modalities: ["pos", "audio"],
    maxN: 10,
    defaultN: 4,
    stimMs: 2500,
    scoreType: "accuracy",
    description:
      'A square lights up and a letter is spoken each trial. Press "Position" and/or "Sound" if that stream matches N steps back.',
  },
  quad: {
    key: "quad",
    title: "Quad N-Back",
    abbrev: "Q",
    accent: "violet",
    modalities: ["pos", "audio", "color", "shape"],
    maxN: 9,
    defaultN: 3,
    stimMs: 3000,
    scoreType: "accuracy",
    description:
      "Now with independent shape and color streams (e.g. a blue square, an orange star). Press any button whose stream matches N steps back.",
  },
  rrt: {
    key: "rrt",
    title: "RRT",
    abbrev: "R",
    accent: "amber",
    modalities: [],
    maxN: 9, // level 9 = 10p — the ceiling for RRT's own achievements/gem tiers (level = premiseCount - 1, starting at 2p)
    defaultN: 1,
    stimMs: 0,
    comingSoon: false,
    scoreType: "points",
    description:
      "Relational Reasoning Training. Read a chain of premises about a set of items, then answer whether the final relationship holds. Each round is randomly a \"same as\"/\"opposite of\" round, a \"contains\"/\"is within\" round, a \"more than\"/\"less than\" round, or an \"on top of\"/\"is under\" round.",
  },
  iqnb: {
    key: "iqnb",
    title: "QNB'",
    abbrev: "QNB'",
    accent: "cyan",
    modalities: ["pos", "audio", "color", "shape"],
    maxN: 8,
    defaultN: 4,
    stimMs: 2500, // overridden per-run from qnbPrimeSettingsFor once a session starts
    comingSoon: false,
    scoreType: "decimal",
    description:
      "Same as Quad N-Back, but the color/shape stream renders as a Voronoi-textured blob instead of a flat-colored shape, and difficulty ramps in fine 0.01 increments instead of whole levels.",
  },
  motion3d: {
    key: "motion3d",
    title: "3D Motion",
    abbrev: "3D",
    accent: "emerald",
    modalities: [],
    maxN: 10,
    defaultN: 1,
    stimMs: 0,
    comingSoon: false,
    scoreType: "decimal",
    description:
      "Multiple Object Tracking. 10 balls drift inside a rotating 3D volume; 5 flash gold as your targets, then everything turns the same color and moves. Keep your eyes on the center and use your peripheral vision to track all 5 targets, then click them once they stop. Speed adjusts every round based on whether you got all 5.",
  },
};

// Terminal step appended to every regime — landing here shows the Session
// Overview screen. Distinguished from the "coming soon" placeholders by key.
const OVERVIEW_EXERCISE = {
  key: "overview",
  title: "Overview",
  accent: "indigo",
  modalities: [],
  maxN: 1,
  defaultN: 1,
  stimMs: 0,
  description: "",
};

// The three regimes a person can pick from on the landing page. Each is an
// ordered list of {key, minutes} — how long to spend on each exercise, in order.
const REGIMES = [
  {
    key: "low",
    title: "Quick",
    subtitle: "25 min",
    summary: "Dual N-Back only",
    accent: "indigo",
    steps: [{ key: "dual", minutes: 25 }],
  },
  {
    key: "medium",
    title: "Balanced",
    subtitle: "45 min",
    summary: "RRT · QNB' · 3D Motion",
    accent: "cyan",
    steps: [
      { key: "rrt", minutes: 10 },
      { key: "iqnb", minutes: 20 },
      { key: "motion3d", minutes: 15 },
    ],
  },
  {
    key: "high",
    title: "Deep",
    subtitle: "95 min",
    summary: "RRT · Dual N-Back · QNB' · Quad N-Back",
    accent: "lime",
    steps: [
      { key: "rrt", minutes: 10 },
      { key: "dual", minutes: 25 },
      { key: "iqnb", minutes: 20 },
      { key: "quad", minutes: 40 },
    ],
  },
];

function buildRegimeExercises(regime) {
  const steps = regime.steps.map((step) => ({
    ...EXERCISE_LIBRARY[step.key],
    sessionDurationMs: step.minutes * 60 * 1000,
  }));
  return [...steps, OVERVIEW_EXERCISE];
}

let cachedVoice = null;
function pickBestVoice() {
  if (cachedVoice) return cachedVoice;
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer higher-quality "natural"/neural-sounding system voices when present.
  const preferredNamePatterns = [
    /natural/i,
    /neural/i,
    /google us english/i,
    /google uk english/i,
    /samantha/i,
    /aria/i,
  ];
  for (const pattern of preferredNamePatterns) {
    const match = voices.find((v) => pattern.test(v.name) && v.lang.startsWith("en"));
    if (match) {
      cachedVoice = match;
      return match;
    }
  }
  const enVoice = voices.find((v) => v.lang.startsWith("en"));
  cachedVoice = enVoice || voices[0];
  return cachedVoice;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
  };
  // Chrome (and some Chromium-based browsers) have a long-standing bug
  // where the speech synthesis queue silently stops producing audio after
  // enough rapid cancel()+speak() cycles in quick succession — no error,
  // it just goes dead. QNB' is the one exercise whose stimulus timing
  // ramps well below the other exercises' fixed 2500-3000ms (down to
  // 1510ms at its hardest step), which is exactly the fast-repeat pattern
  // that triggers it. Periodically nudging the engine with pause()/resume()
  // is the standard workaround and keeps it alive indefinitely. Skipped
  // while a cancel+requeue is in flight (see `pendingSpeakTimeout` below) —
  // nudging mid-requeue was itself capable of dropping that utterance.
  setInterval(() => {
    if (pendingSpeakTimeout !== null) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 5000);
}

// Tracks the in-flight cancel()→speak() requeue timer (see `speak` below) at
// module scope, since `speak` is a plain function, not a hook. Without this,
// back-to-back trials (audio still speaking/pending from the previous one)
// could each schedule their own 30ms requeue with no way to cancel the
// earlier one — the stale timeout would fire later and call
// synth.speak(oldUtter) on a synth state that had already moved on, which
// either spoke the wrong (previous) letter late or got silently cancelled
// out from under it by yet another trial in between, dropping audio for
// that trial entirely. Clearing any pending requeue at the start of every
// `speak()` call means only the most recent trial's utterance ever survives
// to actually play.
let pendingSpeakTimeout = null;

function speak(letter, onstart) {
  if (!("speechSynthesis" in window)) {
    if (onstart) onstart();
    return;
  }
  const synth = window.speechSynthesis;
  if (pendingSpeakTimeout !== null) {
    clearTimeout(pendingSpeakTimeout);
    pendingSpeakTimeout = null;
  }
  const utter = new SpeechSynthesisUtterance(letter.toLowerCase());
  const voice = pickBestVoice();
  if (voice) utter.voice = voice;
  utter.rate = 1;
  utter.pitch = 1;
  if (onstart) utter.onstart = onstart;
  // Transient synthesis failures (the engine reports "interrupted",
  // "canceled", or similar) previously failed completely silently — no
  // sound, no retry, no signal anything went wrong. One quiet retry catches
  // the common transient case without looping forever on a genuine failure.
  let retried = false;
  utter.onerror = (event) => {
    if (retried || event.error === "canceled" || event.error === "interrupted") {
      // "canceled"/"interrupted" usually just means a newer trial's speak()
      // superseded this one on purpose — not a failure worth retrying.
      return;
    }
    retried = true;
    synth.speak(utter);
  };

  if (synth.speaking || synth.pending) {
    synth.cancel();
    // Cancelling and speaking again in the very same tick is itself one of
    // the known triggers for the queue going dead — give it a beat before
    // queuing the next utterance.
    pendingSpeakTimeout = setTimeout(() => {
      pendingSpeakTimeout = null;
      synth.speak(utter);
    }, 30);
  } else {
    synth.speak(utter);
  }
}

const KEY_BINDINGS = { a: "pos", l: "audio", f: "color", j: "shape" };
const MODALITY_KEY_LABEL = { pos: "A", audio: "L", color: "F", shape: "J" };

// Binaural beats — plays a real produced focus-music/binaural-beats track.
// This is loaded as a normal external file rather than embedded as a
// base64 data URI: large (multi-minute) audio embedded inline as text
// hits real, well-documented size limits in Safari/WebKit specifically
// ("NotSupportedError: Failed to load because no supported source was
// found" past roughly 1MB of embedded data), so a real file path is the
// reliable choice for anything longer than a few seconds. Place the
// audio file at this path relative to wherever the app is served (e.g.
// a `public/audio/` folder in a Vite/CRA/Next app) — update the path
// below if you put it somewhere else.
const BACKGROUND_MUSIC_SRC = "/audio/bina-beats.mp3";
const BINAURAL_VOLUME = 0.35; // background listening level — tune to taste
function useBinauralBeats(enabled) {
  const audioRef = useRef(null);
  const fadeRafRef = useRef(null);
  const [audioError, setAudioError] = useState(null);

  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(BACKGROUND_MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = "auto";
    audioRef.current = audio;
    return audio;
  };

  // Call this DIRECTLY from the toggle's onClick — synchronously, in the
  // same call stack as the actual tap. Autoplay policies require play() to
  // be triggered inside a user gesture; deferring it into a useEffect after
  // a state update can get silently blocked in some browsers, which looks
  // exactly like "toggle is on but nothing plays".
  const unlock = () => {
    setAudioError(null);
    const audio = ensureAudio();
    audio.play().catch((err) => setAudioError(`${err.name}: ${err.message}`));
  };

  useEffect(() => {
    if (enabled && !audioRef.current) unlock(); // in case this effect fires before a prior unlock()
    const audio = audioRef.current;
    if (!audio) return;

    const fadeTo = (target, durationMs) => {
      cancelAnimationFrame(fadeRafRef.current);
      const start = audio.volume;
      const startTime = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        audio.volume = start + (target - start) * t;
        if (t < 1) {
          fadeRafRef.current = requestAnimationFrame(step);
        } else if (target === 0) {
          audio.pause();
        }
      };
      fadeRafRef.current = requestAnimationFrame(step);
    };

    if (enabled) {
      audio.play().catch((err) => setAudioError(`${err.name}: ${err.message}`));
      fadeTo(BINAURAL_VOLUME, 1200);
    } else {
      fadeTo(0, 500);
    }

    return () => cancelAnimationFrame(fadeRafRef.current);
  }, [enabled]);

  // Full teardown only on unmount, not every toggle — keeps the same Audio
  // element (already loaded/decoded) alive across on/off flips.
  useEffect(
    () => () => {
      cancelAnimationFrame(fadeRafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    },
    []
  );

  return { unlock, audioError };
}

function poolFor(modality) {
  if (modality === "pos") return POSITIONS;
  if (modality === "audio") return LETTERS;
  if (modality === "shape") return SHAPE_TYPES;
  if (modality === "color") return COLORS;
  return [];
}

// `matchChance` is the probability that an eligible trial (i >= n) is a real
// n-back match. Dual N-Back runs at 30%, Quad N-Back at 25% — QNB' isn't
// affected by this default since its own level-progression settings pass
// their own match chance in explicitly (see qnbPrimeSettingsFor).
// `interference` (0-0.32) is the chance that a non-match trial is a
// deliberate "lure": it reuses the item from n-1 or n+1 trials back instead
// of a fresh random one, so it superficially resembles a recent repeat
// without actually being the true n-back match — e.g. with n=3 and a lure
// from n-1 back, the sequence might read A B D D A: at i=4 the true 3-back
// item is B, but the value shown (A) was also seen 1 trial ago, tempting a
// press based on "feels familiar" recall rather than accurate n-back
// tracking. Higher interference = more of these confusable near-misses =
// harder to tell real matches from lookalikes.
function generateStream(pool, n, length, interference = 0, matchChance = 0.3) {
  const stream = [];
  for (let i = 0; i < length; i++) {
    if (i >= n && Math.random() < matchChance) {
      stream.push(stream[i - n]);
      continue;
    }
    const lureOffsets = [n - 1, n + 1].filter((k) => k >= 1 && i >= k);
    if (lureOffsets.length > 0 && Math.random() < interference) {
      const offset = lureOffsets[Math.floor(Math.random() * lureOffsets.length)];
      const lureVal = stream[i - offset];
      // Only counts as a lure if it doesn't happen to equal the true n-back
      // item too — otherwise it'd secretly be a real match, not a decoy.
      if (!(i >= n && lureVal === stream[i - n])) {
        stream.push(lureVal);
        continue;
      }
    }
    let v;
    do {
      v = pool[Math.floor(Math.random() * pool.length)];
    } while (i >= n && v === stream[i - n] && Math.random() < 0.7);
    stream.push(v);
  }
  return stream;
}

function generateSequence(modalities, n, length, interference = 0, matchChance = 0.3) {
  const seq = { __n: n };
  modalities.forEach((m) => {
    seq[m] = generateStream(poolFor(m), n, length, interference, matchChance);
  });
  return seq;
}

// QNB' ("QNB prime") difficulty progression.
//
// Every other N-back exercise uses one fixed interference value the whole
// time (12%, see the `interference` state default below). QNB' is
// different: instead of a flat difficulty at each whole N level, it ramps
// three settings together in 0.01 increments as the person climbs from
// X.00 (easiest) up to X.99 (hardest) at whichever whole N they're on —
// e.g. 4.00 → 4.01 → 4.02 … → 4.99. Hitting X.99 and leveling up to
// (X+1).00 resets all three back to their easiest values below; the whole
// table here just describes that one X.00→X.99 climb and gets reused
// unchanged at every whole N level.
//
//   step  0 (X.00, easiest): 25% match chance, 0% interference, 2500ms
//   step 99 (X.99, hardest): 13% match chance, 34% interference, 1510ms
//
// Match chance and interference each move in irregular little plateaus
// (per the source table), so they're stored explicitly below rather than
// computed. Stimulus timing is perfectly uniform — 10ms less per 0.01
// step, the whole way from 2500ms down to 1510ms — so that one's a plain
// formula instead of a 100-entry array.
const QNB_PRIME_MATCH_CHANCE = [
  25, 25, 25, 24, 24, 24, 24, 24, 24, 23, 23, 23, 23, 23, 23, 23, 22, 22, 22, 22,
  22, 21, 21, 21, 21, 21, 21, 21, 21, 20, 20, 20, 20, 20, 20, 20, 19, 19, 19, 19,
  19, 19, 19, 19, 18, 18, 18, 18, 18, 18, 18, 18, 17, 17, 17, 17, 17, 17, 17, 17,
  16, 16, 16, 16, 16, 16, 16, 16, 16, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14,
  14, 14, 14, 14, 14, 14, 14, 14, 14, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13,
];
const QNB_PRIME_INTERFERENCE = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
  6, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12,
  13, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22,
  22, 23, 24, 24, 25, 25, 26, 26, 27, 28, 28, 29, 30, 30, 31, 32, 32, 33, 34, 34,
];
function qnbPrimeStimulusMs(step) {
  return 2500 - Math.max(0, Math.min(99, step)) * 10;
}

// step is 0-99 — the two digits after the decimal point (X.00 → step 0,
// X.37 → step 37, X.99 → step 99). Returns that step's full settings.
function qnbPrimeSettingsFor(step) {
  const clamped = Math.max(0, Math.min(99, Math.round(step)));
  return {
    matchChancePct: QNB_PRIME_MATCH_CHANCE[clamped],
    interferencePct: QNB_PRIME_INTERFERENCE[clamped],
    stimulusMs: qnbPrimeStimulusMs(clamped),
  };
}

// Splits a QNB' level like 4.37 into its whole N (4) and 0-99 step (37).
function qnbPrimeLevelParts(level) {
  const whole = Math.floor(level);
  const step = Math.round((level - whole) * 100);
  return { whole, step };
}

// How much a QNB' session's accuracy moves the level (in 0.01 steps).
//
// Retuned against 11 consecutive rows of a real Quad N-Back log (level
// 6.49–6.55, Perf 0.85–1.56), lining up each session's score against the
// level change applied to the very next session:
//
//   Perf   Position Audio Color Shape  →  next-session level change
//   0.85     24%     40%   23%   12%   →  -0.02
//   1.13     46%     25%   17%   38%   →  -0.02
//   1.17     62%     46%   19%   13%   →  -0.02
//   1.21     36%     46%   14%   38%   →   0.00
//   1.26     54%     33%    8%   35%   →   0.00
//   1.34     56%     42%   17%   29%   →   0.00
//   1.44     57%     50%   15%   38%   →   0.00
//   1.48     64%     55%    7%   40%   →   0.00
//   1.49     57%     38%   27%   20%   →   0.00
//   1.56     55%     78%    0%   21%   →   0.00
//
// That confirms two things: the -0.02 step size was already right (every
// drop in the log is exactly one step), and the "no change" band is far
// more forgiving than the 50% originally guessed here — every session that
// held its level averaged under 42% across its four streams, and the
// decrease/hold boundary actually sits at Perf ≈ 1.17–1.21, not anywhere
// near 50%.
//
// The log's own "Perf" is a weighted composite of the four modality
// accuracies that doesn't reduce cleanly to their plain average (fitting
// every threshold combination tried — average, weighted average, geometric
// mean — against these 10 rows leaves one unexplained outlier: the 1.17
// session, whose 62%/46% Position/Audio look fine but whose Color/Shape
// (19%/13%) were both weak, which a straight average smooths over). QNB'
// only has one accuracy stream to begin with, so an exact composite isn't
// reproducible here regardless — but the average of this log's four
// streams gives the closest single-number match to Perf found (best
// separating threshold ≈ 32% average accuracy, 9/10 rows correct), which
// is what the cutoff below is based on.
//
//   accuracy < 33%          → -0.02  (really bad: level goes down)
//   33% ≤ accuracy < 75%    →  0.00  (bad/OK: no change, doesn't go up)
//   75% ≤ accuracy < 90%    → +0.01  (good: goes up a little)
//   accuracy ≥ 90%          → +0.04  (really good: goes up more)
//
// The upper two tiers (75%/90%) are untouched — nothing in this log ever
// held above 42%, so there's no evidence yet for where increases actually
// kick in; they stay as placeholders until a session that levels up shows
// up in a real log.
function qnbPrimeLevelDelta(accuracyPct) {
  if (accuracyPct < 33) return -0.02;
  if (accuracyPct < 75) return 0;
  if (accuracyPct < 90) return 0.01;
  return 0.04;
}

function emptyModalityState(modalities, value) {
  const obj = {};
  modalities.forEach((m) => (obj[m] = value));
  return obj;
}

const PASS_THRESHOLD = 80;

// Trials are ~30% matches / ~70% non-matches, so raw "% correct" is misleading, and
// even "balanced accuracy" (avg of hit-rate and correct-rejection-rate) has a hard
// floor of exactly 50% for ANY non-informative strategy — never pressing, always
// pressing, or pressing at random all land at ~50%, since correct-rejections give
// free credit for passive non-response.
// Instead, score like a signal-detection precision metric that gives credit ONLY
// for genuine hits, and directly penalizes both false alarms (pressing on a
// non-match) and misses (failing to press on a match) in the same ratio:
//   score = hits / (hits + falseAlarms + misses)
// Never pressing anything now scores 0% (all matches missed, credited nowhere).
// Pressing everything scores low too (every non-match becomes a false alarm).
// Only actually catching real matches while avoiding false alarms scores high.
function modalitySignalAccuracy(records, modality) {
  const relevant = records.filter((r) => r[modality]);
  let hits = 0;
  let falseAlarms = 0;
  let misses = 0;
  relevant.forEach((r) => {
    const { match, responded } = r[modality];
    if (match && responded) hits++;
    else if (match && !responded) misses++;
    else if (!match && responded) falseAlarms++;
    // !match && !responded (correct rejection) contributes to neither side —
    // it's the expected default and shouldn't inflate the score.
  });
  const denom = hits + falseAlarms + misses;
  return denom ? hits / denom : 1; // no matches & no false alarms in this session: nothing to penalize
}

function overallSignalAccuracy(records, modalities) {
  if (!modalities.length) return 0;
  const avg =
    modalities.reduce((sum, m) => sum + modalitySignalAccuracy(records, m), 0) /
    modalities.length;
  return Math.round(avg * 100);

}

// Sum of a per-exercise history's session durations, restricted to a predicate on the entry.
function sumHistoryDuration(exerciseHistory, predicate) {
  return Object.values(exerciseHistory).reduce((sum, hist) => {
    return (
      sum +
      (hist || []).reduce(
        (s, h) => s + (predicate(h) ? h.durationMs || 0 : 0),
        0
      )
    );
  }, 0);
}
function msTrainedToday(exerciseHistory) {
  const todayStr = new Date().toDateString();
  return sumHistoryDuration(
    exerciseHistory,
    (h) => new Date(h.ts).toDateString() === todayStr
  );
}
function msTrainedTotal(exerciseHistory) {
  return sumHistoryDuration(exerciseHistory, () => true);
}
// Consecutive days (counting back from today) with at least one session logged
// in any exercise — used for streak-based achievements. `brokenAt`, if set,
// severs the count at that date (e.g. the day the person confirmed switching
// regimes with a live streak) so the count resets to 0 from there.
function currentStreakDays(exerciseHistory, brokenAt) {
  const days = new Set();
  Object.values(exerciseHistory).forEach((hist) => {
    (hist || []).forEach((h) => days.add(new Date(h.ts).toDateString()));
  });
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toDateString();
    if (brokenAt && key === brokenAt) break;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Every calendar date (as toDateString()) with at least one logged session —
// feeds the streak popup's week-of-circles view.
function trainedDateStrings(exerciseHistory) {
  const days = new Set();
  Object.values(exerciseHistory).forEach((hist) => {
    (hist || []).forEach((h) => days.add(new Date(h.ts).toDateString()));
  });
  return days;
}

// This calendar week (Sunday–Saturday) as actual Date objects, for the
// streak popup's row of day circles.
function currentWeekDates() {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sunday
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    week.push(d);
  }
  return week;
}

// Consecutive days (counting back from today) where the person completed
// their FULL daily regime (reached the Session Overview screen at the end of
// a training session) — stricter than currentStreakDays above, which only
// requires any single session logged that day. Feeds the 7-day regime-streak
// achievement.
function currentRegimeStreakDays(regimeCompletionDates) {
  const days = new Set(regimeCompletionDates || []);
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Which automatic train/rest cadence each regime follows.
// "weekday": train Mon–Fri, rest Sat/Sun (Quick, Balanced).
// { type: "interval", days: N }: train once every Nth calendar day,
// continuing indefinitely (Deep) — not pinned to weekends, just cycling
// from whenever the person actually trains.
const REGIME_SCHEDULE = {
  low: "weekday",
  medium: "weekday",
  high: { type: "interval", days: 3 },
};

// Is `date` a scheduled rest day for this regime? Weekday regimes are
// purely calendar-based. Interval regimes are history-based: a day is a
// rest day iff the person trained on any of the (days - 1) calendar days
// immediately before it — so the cadence re-syncs to whenever they
// actually train rather than being pinned to a fixed parity.
function isRegimeRestDay(regimeKey, trainingDates, date) {
  const schedule = REGIME_SCHEDULE[regimeKey];
  if (schedule === "weekday") {
    const dow = date.getDay(); // 0 = Sun, 6 = Sat
    return dow === 0 || dow === 6;
  }
  if (schedule && schedule.type === "interval") {
    const trainedSet = new Set(trainingDates || []);
    const cursor = new Date(date);
    for (let back = 1; back < schedule.days; back++) {
      cursor.setDate(date.getDate() - back);
      if (trainedSet.has(cursor.toDateString())) return true;
    }
    return false;
  }
  return false;
}

// Consecutive scheduled training days completed for this regime, counting
// back from today — rest days (per the regime's own cadence) are skipped
// over rather than required, and the count is severed at `brokenAt` (the
// date, if any, the person trained through a confirmed rest-day warning).
function currentScheduledRegimeStreak(regimeKey, trainingDates, brokenAt) {
  const days = new Set(trainingDates || []);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toDateString();
    if (brokenAt && key === brokenAt) break;
    if (isRegimeRestDay(regimeKey, trainingDates, cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function accuracyColor(pct) {
  // 0% -> red, 50% -> orange, 100% -> green
  const hue = pct <= 50 ? (pct / 50) * 30 : 30 + ((pct - 50) / 50) * 90;
  return `hsl(${hue}, 90%, 62%)`;
}

// Each exercise tracks its "score" in a different unit — N-back games use
// signal-detection accuracy (%), RRT (Relational Reasoning Training) uses
// points with a within-level time increment (Np Ss — e.g. 6p 25s; the
// seconds count DOWN as you improve within a points level: 30s → 25s → 20s,
// then leveling up resets back to 30s at the next points value), and QNB /
// 3D Motion use a decimal composite score (e.g. 4.33). This maps a raw
// stored number to the right display string for its exercise. RRT's raw
// value packs both parts as points + seconds/100 (e.g. 6.25 = "6p 25s").
function formatScoreValue(exercise, value) {
  if (value == null || Number.isNaN(value)) return "—";
  switch (exercise.scoreType) {
    case "points": {
      const points = Math.floor(value);
      const seconds = Math.round((value - points) * 100);
      return `${points}p ${seconds}s`;
    }
    case "decimal":
      return value.toFixed(2);
    case "accuracy":
    default:
      return `${Math.round(value)}%`;
  }
}

// Groups ONE exercise's history into one row per calendar day — the
// spreadsheet view's layout, one table per exercise (matching the chart
// view above it) rather than one combined table with every exercise mashed
// into column pairs. Multiple sessions of the same exercise on the same day
// are summed for duration and reported by their most recent score. Also
// fills in every day between the first recorded session and today that has
// NO session, so the spreadsheet can flag missed days rather than only ever
// showing days something was actually played.
function buildExerciseDailyRows(entries) {
  const dayMap = new Map();
  (entries || []).forEach((h) => {
    const dateKey = new Date(h.ts).toDateString();
    const prev = dayMap.get(dateKey) || { durationMs: 0, accuracy: null, n: null, lastTs: 0, ts: h.ts };
    dayMap.set(dateKey, {
      dateKey,
      ts: Math.max(prev.ts, h.ts),
      durationMs: prev.durationMs + (h.durationMs || 0),
      accuracy: h.ts >= prev.lastTs ? h.accuracy : prev.accuracy,
      n: h.ts >= prev.lastTs ? h.n : prev.n,
      lastTs: Math.max(prev.lastTs, h.ts),
    });
  });
  if (dayMap.size === 0) return [];

  const sessionTimestamps = Array.from(dayMap.values()).map((d) => d.ts);
  const cursor = new Date(Math.min(...sessionTimestamps));
  cursor.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = [];
  while (cursor <= today) {
    const dateKey = cursor.toDateString();
    const existing = dayMap.get(dateKey);
    if (existing) {
      rows.push({ ...existing, missed: false });
    } else {
      rows.push({
        dateKey,
        ts: cursor.getTime(),
        durationMs: 0,
        accuracy: null,
        n: null,
        missed: true,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows.sort((a, b) => b.ts - a.ts);
}

// ---------------------------------------------------------------------
// RRT — Relational Reasoning Training (draft)
// ---------------------------------------------------------------------
// A short chain of items — solid color "Voronoi" swatches and random
// 3-letter tags — connected by "same as" / "opposite of" premises
// (e.g. "FEZ is opposite of the Red Voronoi"). Each item's parity
// (same as vs. opposite of the first item in the chain) is tracked as
// the chain builds, then a single true/false conclusion is asked about
// two items in the chain, sometimes non-adjacent so the person has to
// combine more than one premise to answer it.

const RRT_COLOR_PALETTE = [
  { name: "Orange", hex: "#f97316" },
  { name: "Green", hex: "#22c55e" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Red", hex: "#ef4444" },
];
const RRT_RELATIONS = ["same as", "opposite of"];

// "contains"/"is within", "more than"/"less than", and "on top of"/"is
// under" are all "order" puzzle TYPES — a directed, transitive relation
// over the same branching tree the distinction puzzle above uses, as
// opposed to distinction's same/opposite equivalence. Unlike distinction
// (where any two items in the tree always resolve to a definite answer),
// two items in an order puzzle can end up with NO provable relation at all
// — see generateRrtOrderPuzzle for why. RRT_ORDER_CONFIGS holds the
// vocabulary/phrasing that's different between contains, comparison, and
// vertical; the actual generation and explanation logic is shared. One
// more type is planned (a "space2d" compass-direction variant) but not
// built yet, so it's left out of RRT_PUZZLE_TYPES for now rather than
// stubbed in half-built.
const RRT_ORDER_CONFIGS = {
  contains: {
    label: "Contains",
    // [0] = the "greater" (containing) relation, [1] = the "lesser" (within) relation
    relations: ["contains", "is within"],
    premiseText: (child, parent, childIsGreater) =>
      childIsGreater
        ? `${child.label} contains ${parent.label}.`
        : `${child.label} is within ${parent.label}.`,
    conclusionText: (a, b, askRelation) =>
      askRelation === "contains"
        ? `Does ${a.label} contain ${b.label}?`
        : `Is ${a.label} within ${b.label}?`,
    chainHeading: "Containment Chain",
    reversalNote:
      "The chain reverses direction partway through, so neither item is actually established as containing the other — that's why the honest answer is False.",
  },
  comparison: {
    label: "Comparison",
    relations: ["more than", "less than"],
    premiseText: (child, parent, childIsGreater) =>
      childIsGreater
        ? `${child.label} is more than ${parent.label}.`
        : `${child.label} is less than ${parent.label}.`,
    conclusionText: (a, b, askRelation) => `Is ${a.label} ${askRelation} ${b.label}?`,
    chainHeading: "Comparison Chain",
    reversalNote:
      "The chain reverses direction partway through, so neither item is actually established as more or less than the other — that's why the honest answer is False.",
  },
  vertical: {
    label: "Vertical",
    // [0] = the "greater" (on top) relation, [1] = the "lesser" (under) relation
    relations: ["on top of", "is under"],
    premiseText: (child, parent, childIsGreater) =>
      childIsGreater
        ? `${child.label} is on top of ${parent.label}.`
        : `${child.label} is under ${parent.label}.`,
    conclusionText: (a, b, askRelation) =>
      askRelation === "on top of"
        ? `Is ${a.label} on top of ${b.label}?`
        : `Is ${a.label} under ${b.label}?`,
    chainHeading: "Vertical Chain",
    reversalNote:
      "The chain reverses direction partway through, so neither item is actually established as on top of or under the other — that's why the honest answer is False.",
  },
};
const RRT_PUZZLE_TYPES = ["distinction", "contains", "comparison", "vertical"];
const RRT_PUZZLE_TYPE_LABEL = {
  distinction: "Distinction",
  contains: RRT_ORDER_CONFIGS.contains.label,
  comparison: RRT_ORDER_CONFIGS.comparison.label,
  vertical: RRT_ORDER_CONFIGS.vertical.label,
};

// "is {relation}" reads right for the distinction relations ("is same as",
// "is opposite of") and the comparison relations ("is more than", "is less
// than"), but not for the contains relations — "is within" already has its
// own "is", and "contains" needs no "is" at all ("WEZ contains XEZ", not
// "WEZ is contains XEZ"). Same story for vertical's "is under" (already
// complete) vs. "on top of" (needs the "is " prefix). Centralized here so
// every premise/conclusion render site (the live round, the history log)
// phrases it the same way instead of each guessing at string surgery.
function rrtRelationPhrase(relation) {
  if (relation === "contains") return "contains";
  if (relation === "is within") return "is within";
  if (relation === "on top of") return "is on top of";
  if (relation === "is under") return "is under";
  return `is ${relation}`;
}

const RRT_CONSONANTS = "BCDFGHJKLMNPRSTVWZ".split("");
const RRT_VOWELS = "AEIOU".split("");

function rrtRandomLetters(used) {
  // Reject any candidate that's only a single letter off from a word
  // already in play (e.g. SUJ vs VUJ) — those are too easy to mix up at
  // a glance, even though they're technically different words.
  const tooSimilar = (candidate) => {
    for (const u of used) {
      let diff = 0;
      for (let i = 0; i < candidate.length; i++) {
        if (candidate[i] !== u[i]) diff++;
      }
      if (diff <= 1) return true;
    }
    return false;
  };
  let word;
  let attempts = 0;
  do {
    const c1 = RRT_CONSONANTS[Math.floor(Math.random() * RRT_CONSONANTS.length)];
    const v = RRT_VOWELS[Math.floor(Math.random() * RRT_VOWELS.length)];
    const c2 = RRT_CONSONANTS[Math.floor(Math.random() * RRT_CONSONANTS.length)];
    word = `${c1}${v}${c2}`;
    attempts += 1;
  } while ((used.has(word) || tooSimilar(word)) && attempts < 60);
  used.add(word);
  return word;
}

function rrtRandomColor(used) {
  const available = RRT_COLOR_PALETTE.filter((c) => !used.has(c.name));
  const pool = available.length > 0 ? available : RRT_COLOR_PALETTE;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  used.add(choice.name);
  return choice;
}

// Builds the shared item pool (a mix of letter-tags and Voronoi swatches)
// used by every RRT puzzle type — the puzzle-generation logic that connects
// them with premises (with branchingEnabled controlling whether each new
// item links back to a random earlier item, forming a tree, or always the
// most recent one, forming a strict chain) differs per type, but the items
// themselves don't.
function buildRrtItems(itemCount) {
  const usedWords = new Set();
  const usedColors = new Set();

  // Force a genuine mix of letter-tag and Voronoi-swatch items instead of
  // an independent coin flip per item, which can easily land on a chain
  // that's almost all one type by chance. Split close to 50/50, capped so
  // the Voronoi count never exceeds the number of distinct colors
  // available — repeating a color would be just as confusing as two
  // similar-looking letter tags.
  const voronoiCount = Math.min(
    Math.round(itemCount / 2),
    RRT_COLOR_PALETTE.length
  );
  const types = Array.from({ length: itemCount }, (_, i) =>
    i < voronoiCount ? "voronoi" : "letters"
  );
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  return types.map((type) => {
    if (type === "voronoi") {
      const color = rrtRandomColor(usedColors);
      return { type: "voronoi", hex: color.hex, colorName: color.name, label: `the ${color.name} Voronoi` };
    }
    const letters = rrtRandomLetters(usedWords);
    return { type: "letters", letters, label: letters };
  });
}

// Picks two items at least 2 tree-links apart (see the comment further
// down where this same requirement is explained for the distinction
// puzzle) — shared by every RRT puzzle type since they all build a single
// connected, cycle-free tree over the same item pool, just with different
// premise semantics laid over the edges.
function pickRrtConclusionPair(itemCount, adjacency) {
  function bfsDistances(start) {
    const dist = new Array(itemCount).fill(-1);
    dist[start] = 0;
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const next of adjacency[cur]) {
        if (dist[next] === -1) {
          dist[next] = dist[cur] + 1;
          queue.push(next);
        }
      }
    }
    return dist;
  }

  const startOrder = Array.from({ length: itemCount }, (_, i) => i);
  for (let i = startOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [startOrder[i], startOrder[j]] = [startOrder[j], startOrder[i]];
  }
  let aIdx = startOrder[0];
  let candidates = [];
  for (const start of startOrder) {
    const dist = bfsDistances(start);
    const found = dist.map((d, i) => i).filter((i) => dist[i] >= 2);
    if (found.length > 0) {
      aIdx = start;
      candidates = found;
      break;
    }
  }
  const bIdx = candidates[Math.floor(Math.random() * candidates.length)];
  return { aIdx, bIdx };
}

// Picks which puzzle TYPE a new round should use — uniform random across
// whatever's in RRT_PUZZLE_TYPES.
function pickRrtPuzzleType() {
  return RRT_PUZZLE_TYPES[Math.floor(Math.random() * RRT_PUZZLE_TYPES.length)];
}

function generateRrtPuzzle(premiseCount, branchingEnabled = true, puzzleType) {
  const type = puzzleType || pickRrtPuzzleType();
  if (RRT_ORDER_CONFIGS[type]) {
    return generateRrtOrderPuzzle(premiseCount, branchingEnabled, type);
  }
  return generateRrtDistinctionPuzzle(premiseCount, branchingEnabled);
}

function generateRrtDistinctionPuzzle(premiseCount, branchingEnabled = true) {
  const itemCount = premiseCount + 1;
  const items = buildRrtItems(itemCount);

  // parity[i] = 0 means items[i] is "same as" items[0]; 1 means "opposite of" items[0]
  const parity = [0];
  const premises = [];
  const adjacency = Array.from({ length: itemCount }, () => []); // undirected — for graph-distance below
  for (let i = 1; i < items.length; i++) {
    const parentIdx = branchingEnabled ? Math.floor(Math.random() * i) : i - 1;
    const relation = RRT_RELATIONS[Math.floor(Math.random() * RRT_RELATIONS.length)];
    parity.push(relation === "same as" ? parity[parentIdx] : 1 - parity[parentIdx]);
    premises.push({
      subject: items[i],
      relation,
      object: items[parentIdx],
      text: `${items[i].label} is ${relation} ${items[parentIdx].label}.`,
    });
    adjacency[i].push(parentIdx);
    adjacency[parentIdx].push(i);
  }

  // Keep the conclusion's two items at least 2 links apart in the tree —
  // premises only ever relate items directly connected by an edge, so
  // picking a directly-connected pair here could land on the exact same
  // subject/relation/object as one of them (or, even when the wording
  // differs, be answerable from that one premise alone), letting the
  // person skip the actual chain reasoning the puzzle is meant to test.
  // Every tree with 3+ items has SOME pair 2+ apart, but not every item is
  // necessarily one end of such a pair (e.g. the center of a star) — so
  // pickRrtConclusionPair tries each item as a starting point (in random
  // order) until one works.
  const { aIdx, bIdx } = pickRrtConclusionPair(itemCount, adjacency);
  const askRelation = RRT_RELATIONS[Math.floor(Math.random() * RRT_RELATIONS.length)];
  const relativeParity = parity[aIdx] ^ parity[bIdx];
  const answer = askRelation === "same as" ? relativeParity === 0 : relativeParity === 1;

  return {
    items,
    premises,
    puzzleType: "distinction",
    conclusion: {
      subject: items[aIdx],
      relation: askRelation,
      object: items[bIdx],
      text: `Is ${items[aIdx].label} ${askRelation} ${items[bIdx].label}?`,
      answer,
    },
  };
}

// The "order" RRT puzzle types — contains/is-within and more-than/less-than
// — share this one generator. Same tree-of-premises shape as the
// distinction puzzle above (each item after the first gets one premise
// connecting it back to an earlier item, branching or not), but the
// relation is directed and transitive rather than a same/opposite
// equivalence. That has a real consequence: unlike distinction, where any
// two items in the tree always resolve to a definite same-as/opposite-of
// answer no matter how they're connected, two items here can end up with
// NO provable relation at all — e.g. two different things both contain (or
// are both more than) the same third item, which says nothing about how
// those two relate to each other. So each edge gets a random direction,
// and the conclusion is worked out by walking the unique tree path between
// the two chosen items and checking whether every edge along that path
// points the same way. If it does, the order holds transitively (in
// whichever direction); if the path reverses direction anywhere, neither
// direction of the relation is actually established, and the honest
// answer is False either way.
function generateRrtOrderPuzzle(premiseCount, branchingEnabled, typeKey) {
  const config = RRT_ORDER_CONFIGS[typeKey];
  const itemCount = premiseCount + 1;
  const items = buildRrtItems(itemCount);

  const premises = [];
  const adjacency = Array.from({ length: itemCount }, () => []); // undirected — for graph-distance
  // signedAdjacency[u] = [{to, sign}] — sign +1 means "u is the greater
  // (config.relations[0]) side of the relation to `to`", -1 means the
  // reverse (config.relations[1]).
  const signedAdjacency = Array.from({ length: itemCount }, () => []);
  for (let i = 1; i < items.length; i++) {
    const parentIdx = branchingEnabled ? Math.floor(Math.random() * i) : i - 1;
    const iIsGreater = Math.random() < 0.5;
    const relation = iIsGreater ? config.relations[0] : config.relations[1];
    premises.push({
      subject: items[i],
      relation,
      object: items[parentIdx],
      text: config.premiseText(items[i], items[parentIdx], iIsGreater),
    });
    adjacency[i].push(parentIdx);
    adjacency[parentIdx].push(i);
    signedAdjacency[i].push({ to: parentIdx, sign: iIsGreater ? 1 : -1 });
    signedAdjacency[parentIdx].push({ to: i, sign: iIsGreater ? -1 : 1 });
  }

  const { aIdx, bIdx } = pickRrtConclusionPair(itemCount, adjacency);

  // Walk the tree's unique path from aIdx to bIdx (BFS — always finds it,
  // since the graph is connected and acyclic), collecting the sign of each
  // edge crossed. All +1 the whole way means A is the "greater" side of B
  // transitively; all -1 means the reverse; any mix means the path
  // reverses somewhere along the way and no relation is established.
  function pathSigns(start, end) {
    const visited = new Array(itemCount).fill(false);
    visited[start] = true;
    const queue = [[start, []]];
    while (queue.length) {
      const [cur, signs] = queue.shift();
      if (cur === end) return signs;
      for (const edge of signedAdjacency[cur]) {
        if (!visited[edge.to]) {
          visited[edge.to] = true;
          queue.push([edge.to, [...signs, edge.sign]]);
        }
      }
    }
    return [];
  }
  const signs = pathSigns(aIdx, bIdx);
  const allGreater = signs.length > 0 && signs.every((s) => s === 1);
  const allLesser = signs.length > 0 && signs.every((s) => s === -1);
  // "aGreater" | "bGreater" | "none" (no provable relation either way)
  const actual = allGreater ? "aGreater" : allLesser ? "bGreater" : "none";

  const askRelation = config.relations[Math.floor(Math.random() * 2)];
  const answer =
    askRelation === config.relations[0] ? actual === "aGreater" : actual === "bGreater";

  return {
    items,
    premises,
    puzzleType: typeKey,
    conclusion: {
      subject: items[aIdx],
      relation: askRelation,
      object: items[bIdx],
      text: config.conclusionText(items[aIdx], items[bIdx], askRelation),
      answer,
    },
  };
}

// Determines the ORDER premises are shown to the person during the
// "premises" walkthrough for a round — NOT the puzzle's underlying premise
// structure (a tree of items, not necessarily items[0]-items[1]-...-
// items[n-1] end to end — see generateRrtPuzzle), which always stays in
// the order premises was built for scoring and for the Explanation
// popup's parity grouping, regardless of this setting.
//
// scrambleFactor 0 = show premises in natural chain order, so every
// premise you just read shares an item with the very next one — easy to
// hold the thread. scrambleFactor 1 = actively avoid putting two
// item-sharing premises back to back, so natural neighbors are rare.
// Values in between keep roughly that fraction of the natural "neighbor"
// links intact (as unscrambled runs) and shuffle the rest.
//
// NOTE: the "every premise links to the next" guarantee at 0 only holds if
// the underlying item graph is a straight chain to begin with — the caller
// (RRTExercise's beginRound) forces branchingEnabled off whenever
// scrambleFactor is 0 so this promise can't be silently broken by a
// branching tree still being on.
function scramblePremiseOrder(premises, scrambleFactor) {
  const n = premises.length;
  const indices = premises.map((_, i) => i);
  if (n <= 1 || scrambleFactor <= 0) return indices;

  const keepFraction = 1 - scrambleFactor;
  const linksToKeep = Math.round(keepFraction * (n - 1));

  // Spread the kept links evenly across the chain rather than clustering
  // them, so partial scramble reads as "some pairs stay together
  // throughout" instead of "one big untouched chunk at the start".
  const keepLinkSet = new Set();
  if (linksToKeep > 0) {
    const step = (n - 1) / linksToKeep;
    for (let k = 0; k < linksToKeep; k++) {
      keepLinkSet.add(Math.round(k * step));
    }
  }

  // Cut the natural sequence into chunks at every link NOT kept — the
  // premises inside each chunk stay in their original relative order.
  const chunks = [];
  let current = [indices[0]];
  for (let i = 1; i < n; i++) {
    if (keepLinkSet.has(i - 1)) {
      current.push(indices[i]);
    } else {
      chunks.push(current);
      current = [indices[i]];
    }
  }
  chunks.push(current);

  // Shuffling the chunks (not the individual premises inside them) is
  // what actually scrambles the viewing order.
  for (let i = chunks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
  }

  const order = chunks.flat();

  // At higher scramble levels, also break up any chunk-boundary
  // collisions where two premises that happen to share an item still
  // ended up adjacent purely by chance of the chunk shuffle.
  if (scrambleFactor > 0.5) {
    const shares = (a, b) =>
      a.subject === b.subject ||
      a.subject === b.object ||
      a.object === b.subject ||
      a.object === b.object;
    for (let i = 0; i < order.length - 1; i++) {
      const a = premises[order[i]];
      const b = premises[order[i + 1]];
      if (shares(a, b)) {
        for (let j = i + 2; j < order.length; j++) {
          if (!shares(a, premises[order[j]])) {
            [order[i + 1], order[j]] = [order[j], order[i + 1]];
            break;
          }
        }
      }
    }
  }

  return order;
}

// A single item — a real Voronoi-cell mosaic swatch for color items (a
// handful of irregularly-shaped polygons with visible boundary lines,
// computed as an actual Voronoi diagram via half-plane clipping — not just
// a flat solid square), or plain bold text for letter-tag items. The cell
// layout is seeded off the item's own color name/hex so it's stable across
// re-renders instead of re-randomizing every frame.
function hashStringToSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function shadeHex(hex, amt) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  const adjust = (c) =>
    Math.max(0, Math.min(255, Math.round(c + (amt >= 0 ? (255 - c) * amt : c * amt))));
  r = adjust(r);
  g = adjust(g);
  b = adjust(b);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function mixHex(hexA, hexB, t) {
  const a = parseInt(hexA.replace("#", ""), 16);
  const b = parseInt(hexB.replace("#", ""), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
// Accent colors mixed into cells for real hue variation (white, magenta,
// cyan, gold, near-black) instead of every cell just being a lighter/darker
// tint of the same single base hue.
const VORONOI_ACCENTS = ["#ffffff", "#ec4899", "#22d3ee", "#facc15", "#111827"];
// Sutherland-Hodgman clip of a convex polygon against the half-plane
// { p : p·(nx,ny) <= c } — used below to carve out each Voronoi cell as the
// intersection of the bounding box with the "closer to me than to them"
// half-plane for every other seed point.
function clipPolygonHalfPlane(poly, nx, ny, c) {
  const output = [];
  const len = poly.length;
  for (let i = 0; i < len; i++) {
    const curr = poly[i];
    const prev = poly[(i - 1 + len) % len];
    const currInside = curr[0] * nx + curr[1] * ny <= c;
    const prevInside = prev[0] * nx + prev[1] * ny <= c;
    if (currInside !== prevInside) {
      const d1 = prev[0] * nx + prev[1] * ny - c;
      const d2 = curr[0] * nx + curr[1] * ny - c;
      const t = d1 / (d1 - d2);
      output.push([prev[0] + t * (curr[0] - prev[0]), prev[1] + t * (curr[1] - prev[1])]);
    }
    if (currInside) output.push(curr);
  }
  return output;
}
// A real Voronoi diagram (5-6 seed points, clipped to a 0-100 square) so
// each swatch reads as genuinely different-colored polygonal cells with
// clean boundary lines, like real Voronoi art — not a flat color. Seed
// points are placed on a jittered grid (one per grid cell, nudged
// randomly within it) rather than pure random scatter, so the cells stay
// evenly spread out — pure randomness occasionally clusters points
// together and produces a degenerate two-big-blob look instead of a
// proper mosaic. Each cell's color either mixes in an accent
// (white/magenta/cyan/gold/near-black) for real hue variation, or is a
// plain tint/shade of the base color, so the swatch stays colorful
// without losing its identity entirely.
function jitteredGridPoints(rand, count, cols, rows) {
  const cellIndices = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cellIndices.push([r, c]);
  }
  // Deterministic Fisher-Yates shuffle (using the same seeded rand) so we
  // pick a random subset of grid cells instead of always the first N.
  for (let i = cellIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cellIndices[i], cellIndices[j]] = [cellIndices[j], cellIndices[i]];
  }
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  return cellIndices.slice(0, count).map(([r, c]) => {
    const jx = 0.28 + rand() * 0.44; // stay away from the very edge of the cell
    const jy = 0.28 + rand() * 0.44;
    return [c * cellW + jx * cellW, r * cellH + jy * cellH];
  });
}
function voronoiCells(seedStr, baseHex) {
  const countRand = mulberry32(hashStringToSeed(`${seedStr}-count`));
  const pointCount = 4 + Math.floor(countRand() * 2); // 4-5 seeds — fewer, bigger, clearer cells at small render sizes
  const pointRand = mulberry32(hashStringToSeed(`${seedStr}-points`));
  const points = jitteredGridPoints(pointRand, pointCount, 3, 2); // 3x2 grid = 6 cells, pick 4-5
  const colorRand = mulberry32(hashStringToSeed(`${seedStr}-color`));
  const bbox = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  const cells = [];
  for (let i = 0; i < points.length; i++) {
    let poly = bbox;
    const [ix, iy] = points[i];
    for (let j = 0; j < points.length && poly.length > 0; j++) {
      if (j === i) continue;
      const [jx, jy] = points[j];
      const nx = jx - ix;
      const ny = jy - iy;
      const c = (jx * jx + jy * jy - (ix * ix + iy * iy)) / 2;
      poly = clipPolygonHalfPlane(poly, nx, ny, c);
    }
    if (poly.length >= 3) {
      // Bolder, more saturated accent mixing (higher odds, wider blend
      // range) so cells read as genuinely different hues at a glance —
      // like real mosaic tiles — instead of subtle shades of one color.
      let color;
      if (colorRand() < 0.85) {
        const accent = VORONOI_ACCENTS[Math.floor(colorRand() * VORONOI_ACCENTS.length)];
        color = mixHex(baseHex, accent, 0.4 + colorRand() * 0.45);
      } else {
        color = shadeHex(baseHex, (colorRand() - 0.5) * 1.1);
      }
      cells.push({ points: poly.map((p) => p.join(",")).join(" "), color });
    }
  }
  return cells;
}
function RrtItemTile({ item, size = 40 }) {
  const cells = useMemo(
    () =>
      item.type === "voronoi" ? voronoiCells(item.colorName || item.hex, item.hex) : null,
    [item.type, item.colorName, item.hex]
  );
  if (item.type === "voronoi") {
    const voronoiSize = size * 0.7;
    return (
      <svg
        width={voronoiSize}
        height={voronoiSize}
        viewBox="0 0 100 100"
        className="inline-block rounded-md border border-black/20 shrink-0"
      >
        <rect x="0" y="0" width="100" height="100" fill={item.hex} />
        {cells.map((c, i) => (
          <polygon
            key={i}
            points={c.points}
            fill={c.color}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  }
  return (
    <span className="font-bold tracking-wide text-slate-100" style={{ fontSize: size * 0.5 }}>
      {item.letters}
    </span>
  );
}

// A small clickable chip for an item inside a History log entry — tapping
// it opens an enlarged view (see historyItemPopup in RRTExercise) so a
// pattern that's hard to make out at this size is easy to check.
function RrtHistoryItemChip({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item)}
      className="inline-flex items-center gap-1.5 bg-slate-800/60 hover:bg-slate-800 rounded px-2 py-1 transition-colors"
    >
      <RrtItemTile item={item} size={28} />
    </button>
  );
}

// Walks a history entry's premises (a tree of items — see
// generateRrtPuzzle, not necessarily a straight items[0]-items[1]-...-
// items[n-1] line) to find the specific path that connects the
// conclusion's two items, then re-orders it to read subject → object.
// This is what actually justifies the conclusion's answer — laying out
// every item in between, with the same/opposite relation between each
// consecutive pair, so the whole deduction is visible at once instead of
// just asserting the final answer.
// Dispatches to the right explanation builder for the entry's puzzle type
// — older history entries saved before puzzleType existed default to
// "distinction" (that was the only type there was).
function buildRrtExplanationChain(entry) {
  return RRT_ORDER_CONFIGS[entry.puzzleType]
    ? buildRrtOrderExplanation(entry)
    : buildRrtDistinctionExplanation(entry);
}

function buildRrtDistinctionExplanation(entry) {
  const { items, premises, conclusion } = entry;
  const aIdx = items.indexOf(conclusion.subject);
  const bIdx = items.indexOf(conclusion.object);

  // Rebuild the tree's adjacency (item index -> [{to, sameAs}]) from the
  // premises themselves, since only items/premises/conclusion get stored
  // on a history entry — no separate parent-pointer array survives.
  const adjacency = items.map(() => []);
  premises.forEach((p) => {
    const from = items.indexOf(p.subject);
    const to = items.indexOf(p.object);
    const sameAs = p.relation === "same as";
    adjacency[from].push({ to, sameAs });
    adjacency[to].push({ to: from, sameAs });
  });

  // BFS from the conclusion's subject to find the actual path to its
  // object — the specific chain of premises that justifies the answer,
  // which for a branching tree isn't just "everything between the two
  // indices" the way it was for a straight line.
  const parentEdge = new Array(items.length).fill(null); // parentEdge[i] = {from, sameAs} of the edge that reached i
  const visited = new Array(items.length).fill(false);
  visited[aIdx] = true;
  const queue = [aIdx];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === bIdx) break;
    for (const edge of adjacency[cur]) {
      if (!visited[edge.to]) {
        visited[edge.to] = true;
        parentEdge[edge.to] = { from: cur, sameAs: edge.sameAs };
        queue.push(edge.to);
      }
    }
  }
  const pathIdx = [bIdx];
  const pathRelations = [];
  let cur = bIdx;
  while (cur !== aIdx) {
    const edge = parentEdge[cur];
    pathRelations.push(edge.sameAs ? "same as" : "opposite of");
    cur = edge.from;
    pathIdx.push(cur);
  }
  pathIdx.reverse();
  pathRelations.reverse();
  const chainItems = pathIdx.map((i) => items[i]);
  const chainRelations = pathRelations;

  // The whole tree only ever resolves to two possible values relative to
  // items[0] — "same as it" or "opposite of it" — since every premise
  // links one item to another with a definite same/opposite relation. BFS
  // from items[0] once to sort every item into whichever of those two
  // buckets it lands in, so items that are actually equivalent (e.g.
  // linked same-as-A-same-as-B, or opposite-of-opposite-of, which cancels
  // back to "same") get grouped and shown as one shared value instead of
  // being repeated link-by-link.
  const parity = new Array(items.length).fill(null);
  parity[0] = 0;
  const parityQueue = [0];
  while (parityQueue.length) {
    const cur2 = parityQueue.shift();
    for (const edge of adjacency[cur2]) {
      if (parity[edge.to] === null) {
        parity[edge.to] = edge.sameAs ? parity[cur2] : 1 - parity[cur2];
        parityQueue.push(edge.to);
      }
    }
  }
  const bucket = [[], []];
  items.forEach((it, i) => bucket[parity[i]].push(it));
  const subjectParity = parity[aIdx];
  // Order so the conclusion's subject's group comes first, its object's
  // group (if different) comes second.
  const groups = subjectParity === 0 ? bucket : [bucket[1], bucket[0]];
  const populatedGroups = groups.filter((g) => g.length > 0);

  return { puzzleType: "distinction", chainItems, chainRelations, groups: populatedGroups };
}

// Same idea as buildRrtDistinctionExplanation but for the order puzzle
// types (contains, comparison): walks the tree's unique path between the
// conclusion's subject and object, recording each step's relation read in
// subject → object order. Unlike distinction, that path doesn't reduce to
// two tidy groups — these relations aren't symmetric, so instead this
// reports whether the path is actually a consistent chain in one direction
// (`determinate`) or reverses partway through, which is exactly the case
// where no answer is provable and the honest conclusion is False.
function buildRrtOrderExplanation(entry) {
  const { items, premises, conclusion, puzzleType } = entry;
  const config = RRT_ORDER_CONFIGS[puzzleType];
  const aIdx = items.indexOf(conclusion.subject);
  const bIdx = items.indexOf(conclusion.object);

  // adjacency[u] = [{to, sign}] — sign +1 means "u is the greater
  // (config.relations[0]) side relative to to" — rebuilt from the stored
  // premises the same way the distinction version rebuilds its sameAs
  // adjacency.
  const adjacency = items.map(() => []);
  premises.forEach((p) => {
    const from = items.indexOf(p.subject);
    const to = items.indexOf(p.object);
    const sign = p.relation === config.relations[0] ? 1 : -1;
    adjacency[from].push({ to, sign });
    adjacency[to].push({ to: from, sign: -sign });
  });

  const parentEdge = new Array(items.length).fill(null); // {from, sign} — sign is the from→cur direction
  const visited = new Array(items.length).fill(false);
  visited[aIdx] = true;
  const queue = [aIdx];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === bIdx) break;
    for (const edge of adjacency[cur]) {
      if (!visited[edge.to]) {
        visited[edge.to] = true;
        parentEdge[edge.to] = { from: cur, sign: edge.sign };
        queue.push(edge.to);
      }
    }
  }
  const pathIdx = [bIdx];
  const pathRelations = [];
  let cur = bIdx;
  while (cur !== aIdx) {
    const edge = parentEdge[cur];
    pathRelations.push(edge.sign === 1 ? config.relations[0] : config.relations[1]);
    cur = edge.from;
    pathIdx.push(cur);
  }
  pathIdx.reverse();
  pathRelations.reverse();
  const chainItems = pathIdx.map((i) => items[i]);
  const chainRelations = pathRelations;
  const determinate =
    chainRelations.length > 0 && chainRelations.every((r) => r === chainRelations[0]);

  return { puzzleType, chainItems, chainRelations, determinate, groups: null };
}

function ShapeIcon({ shape, color, size = 64 }) {
  const s = size;
  const common = { fill: color };
  switch (shape) {
    case "square":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <rect x="15" y="15" width="70" height="70" rx="6" {...common} />
        </svg>
      );
    case "triangle":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <polygon points="50,12 90,88 10,88" {...common} />
        </svg>
      );
    case "star":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <polygon
            points="50,5 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38"
            {...common}
          />
        </svg>
      );
    case "circle":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" {...common} />
        </svg>
      );
    case "diamond":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <polygon points="50,6 94,50 50,94 6,50" {...common} />
        </svg>
      );
    case "hexagon":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <polygon
            points="50,6 90,28 90,72 50,94 10,72 10,28"
            {...common}
          />
        </svg>
      );
    default:
      return null;
  }
}

// Per-shape SVG geometry, reused by both the flat ShapeIcon above and the
// voronoi-clipped version below so the two stay pixel-for-pixel aligned.
const SHAPE_CLIP_GEOMETRY = {
  square: { el: "rect", props: { x: 15, y: 15, width: 70, height: 70, rx: 6 } },
  triangle: { el: "polygon", props: { points: "50,12 90,88 10,88" } },
  star: {
    el: "polygon",
    props: { points: "50,5 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38" },
  },
  circle: { el: "circle", props: { cx: 50, cy: 50, r: 42 } },
  diamond: { el: "polygon", props: { points: "50,6 94,50 50,94 6,50" } },
  hexagon: { el: "polygon", props: { points: "50,6 90,28 90,72 50,94 10,72 10,28" } },
};

// QNB' draws its color/shape stimulus as a Voronoi-textured blob clipped to
// the same outline ShapeIcon uses, instead of a flat solid fill — reuses the
// same voronoiCells() generator RRT's Voronoi items use.
function VoronoiShapeIcon({ shape, color, seed, size = 64 }) {
  const geometry = SHAPE_CLIP_GEOMETRY[shape] || SHAPE_CLIP_GEOMETRY.square;
  const clipId = `qnbp-clip-${shape}-${(seed || color).replace(/[^a-zA-Z0-9]/g, "")}`;
  const cells = useMemo(
    () => voronoiCells(`${seed || color}-${shape}`, color),
    [seed, color, shape]
  );
  const ClipEl = geometry.el;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <clipPath id={clipId}>
          <ClipEl {...geometry.props} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="100" fill={color} />
        {cells.map((c, i) => (
          <polygon
            key={i}
            points={c.points}
            fill={c.color}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}


// Tier list is deliberately generic (not tied to any one exercise's max level),
// so e.g. "D6B" (Dual 6-Back) and "Q6B" (Quad 6-Back) both carry the same name.
const GEM_TIERS = {
  1: { color: "#94a3b8", glow: false, label: "Novice" },
  2: { color: "#4ade80", glow: true, label: "Astute" },
  3: { color: "#38bdf8", glow: true, label: "Adept" },
  4: { color: "#818cf8", glow: true, label: "Expert" },
  5: { color: "#22d3ee", glow: true, label: "Bright" },
  6: { color: "#fb7185", glow: true, label: "Radiant" },
  7: { color: "#c084fc", glow: true, label: "Brilliant" },
  8: { color: "#f59e0b", glow: true, label: "Elite" },
  9: { color: "#fde047", glow: true, label: "Transcendent" },
  10: { color: "#ef4444", glow: true, label: "Enlightened" },
};
const GEM_TIER_LEVELS = Object.keys(GEM_TIERS).map(Number);
const MAX_GEM_TIER = Math.max(...GEM_TIER_LEVELS);
function gemTierFor(level) {
  return (
    GEM_TIERS[level] ||
    GEM_TIERS[Math.max(1, Math.min(MAX_GEM_TIER, level))] ||
    GEM_TIERS[1]
  );
}
function rankNameFor(level) {
  return gemTierFor(level).label;
}

function LevelGem({ level, size = 40, glowPulse = false }) {
  const tier = gemTierFor(level);
  // Static everywhere by default — glow (a drop-shadow) and the top-right
  // sparkle accent still show on glow-tier gems, but the pulsing/floating
  // animation is opt-in via the prop, reserved for the level-up celebration
  // overlay so it reads as a special one-off moment instead of ambient motion
  // on every gem across Home, the leaderboard, achievements, etc.
  const pulse = !!glowPulse;
  const s = size;
  const gradId = `gem-grad-${level}-${Math.round(s)}`;
  // A grounding drop-shadow (for depth/pop) plus, on higher tiers, a soft
  // colored glow — real blurred shadows rather than a flat tinted circle
  // sitting behind the gem.
  const groundShadow = `drop-shadow(0 ${Math.max(2, s * 0.05)}px ${Math.max(
    3,
    s * 0.09
  )}px rgba(0,0,0,0.55))`;
  const colorGlow = tier.glow ? ` drop-shadow(0 0 ${s * 0.16}px ${tier.color}99)` : "";
  const sparkleSize = Math.max(9, s * 0.22);

  return (
    <div className="relative inline-block" style={{ width: s, height: s }}>
      {/* The same floating-sparkle treatment from the level-up celebration,
          now built into the gem itself so it shows up everywhere a
          glow-tier gem renders — Home, leaderboard, setup, not just the
          one-off unlock overlay. Two drift upward and fade; a third sits
          low-opacity at the bottom rather than fully fading, like a resting
          glint. */}
      {pulse && (
        <>
          <div
            className="absolute pointer-events-none select-none"
            style={{
              top: -s * 0.12,
              left: -s * 0.14,
              fontSize: sparkleSize,
              animation: "sparkleFloat 1.6s ease-out infinite",
              animationDelay: "0.15s",
            }}
          >
            ✨
          </div>
          <div
            className="absolute pointer-events-none select-none"
            style={{
              top: -s * 0.05,
              right: -s * 0.18,
              fontSize: sparkleSize * 0.82,
              animation: "sparkleFloat 1.9s ease-out infinite",
              animationDelay: "0.55s",
            }}
          >
            ✨
          </div>
          <div
            className="absolute pointer-events-none select-none opacity-50"
            style={{
              bottom: -s * 0.08,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: sparkleSize * 0.7,
              animation: "sparkleFloat 2.2s ease-out infinite",
              animationDelay: "1.1s",
            }}
          >
            ✨
          </div>
        </>
      )}
      <svg
        width={s}
        height={s}
        viewBox="0 0 100 106"
        style={{
          overflow: "visible",
          filter: `${groundShadow}${colorGlow}`,
          ...(pulse
            ? { animation: "gemGlowPulse 2s ease-in-out infinite", "--glow-color": tier.color }
            : {}),
        }}
      >
        <defs>
          <radialGradient id={gradId} cx="38%" cy="26%" r="88%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="30%" stopColor={tier.color} stopOpacity="1" />
            <stop offset="100%" stopColor={tier.color} stopOpacity="0.82" />
          </radialGradient>
        </defs>

        {/* outer silhouette — flat table top, girdle at the widest point, tapering to a culet */}
        <polygon
          points="38,14 62,14 86,28 93,45 50,101 7,45 14,28"
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* table facet */}
        <polygon points="38,14 62,14 77,32 23,32" fill="rgba(255,255,255,0.38)" />
        {/* crown facets either side of the table */}
        <polygon points="14,28 38,14 23,32" fill="rgba(255,255,255,0.22)" />
        <polygon points="62,14 86,28 77,32" fill="rgba(255,255,255,0.1)" />
        <polygon points="7,45 14,28 23,32" fill="rgba(255,255,255,0.14)" />
        <polygon points="93,45 86,28 77,32" fill="rgba(0,0,0,0.08)" />

        {/* pavilion facets tapering to the point */}
        <polygon points="7,45 23,32 50,101" fill="rgba(0,0,0,0.2)" />
        <polygon points="93,45 77,32 50,101" fill="rgba(255,255,255,0.08)" />
        <polygon points="23,32 77,32 50,101" fill="rgba(0,0,0,0.05)" />

        {/* shine glint on the table */}
        <polygon points="42,18 48,27 36,27" fill="rgba(255,255,255,0.85)" />

        {tier.glow && (
          <path
            d="M85 15 L87.5 22 L94 24.5 L87.5 27 L85 34 L82.5 27 L76 24.5 L82.5 22 Z"
            fill="#ffffff"
            opacity="0.9"
          />
        )}
      </svg>
    </div>
  );
}

// Custom dropdown (not a native <select>) so the open menu stays styled like
// the rest of the app — a native <select>'s option list is rendered by the
// OS/browser and can't be dark-themed, which looked jarring against the app.
function Dropdown({ options, value, onChange, accent, label }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  const selected = options.find((o) => o.value === value);
  const a = accent || ACCENT_STYLES.indigo;
  return (
    <div ref={containerRef} className="relative">
      {label && (
        <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 rounded-lg py-4 px-5 text-lg font-medium border bg-slate-900 cursor-pointer transition-colors ${
          open ? a.borderStrong : `${a.border} hover:border-slate-500`
        } ${a.text}`}
      >
        <span>{selected?.label}</span>
        <svg
          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-2 rounded-lg border border-slate-700 bg-slate-900 shadow-xl shadow-black/50 overflow-hidden"
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-5 py-3 text-base transition-colors cursor-pointer ${
                  isActive
                    ? `${a.bg} ${a.text} font-semibold`
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Preset avatar options — mockup only (no photo upload / accounts backend yet).
const AVATAR_OPTIONS = [
  { id: "fox", emoji: "🦊", bg: "#f97316" },
  { id: "owl", emoji: "🦉", bg: "#8b5cf6" },
  { id: "panda", emoji: "🐼", bg: "#64748b" },
  { id: "tiger", emoji: "🐯", bg: "#eab308" },
  { id: "koala", emoji: "🐨", bg: "#94a3b8" },
  { id: "turtle", emoji: "🐢", bg: "#22c55e" },
  { id: "dolphin", emoji: "🐬", bg: "#3b82f6" },
  { id: "octopus", emoji: "🐙", bg: "#ec4899" },
];
// Reward avatars — not selectable from the start. Each is gated behind the
// real unlock condition of the ACHIEVEMENTS_CATALOG entry named in
// `unlockedBy`, so it only becomes pickable once that achievement's
// `unlocked(state)` actually returns true for the person's real stats.
// (Empty for now — the 1-Month Streak achievement used to reward a bonus
// avatar here, but its only reward is unlocking the Custom regime now.)
const BONUS_AVATAR_OPTIONS = [];

// Profile cosmetics — every unlockable "equip" the person can put on their
// profile (frame, accent color, background), Club Penguin-style: several can
// be unlocked at once, but only one per category is actively equipped.
// `unlockedBy` names an ACHIEVEMENTS_CATALOG id; null means available from
// the start. These are mockups — see isCosmeticUnlocked below for the shared
// unlock check (reuses the same real/simulated achievement logic as badges).
const FRAME_OPTIONS = [
  { id: "none", label: "None", unlockedBy: null },
  { id: "glow", label: "Glow", unlockedBy: "regimeStreak7" },
  { id: "splitTone", label: "Split Tone", unlockedBy: "wellRounded" },
  { id: "aura", label: "Aura", unlockedBy: "streak180" },
];
const PROFILE_COLOR_OPTIONS = [
  { id: "indigo", label: "Indigo", unlockedBy: null },
  { id: "violet", label: "Violet", unlockedBy: "dualAdept" },
  { id: "cyan", label: "Cyan", unlockedBy: "hours5" },
  { id: "amber", label: "Amber", unlockedBy: "sessions50" },
  { id: "rose", label: "Rose", unlockedBy: "perfectRun" },
  { id: "emerald", label: "Emerald", unlockedBy: "wellRounded" },
];
const PROFILE_BACKGROUND_OPTIONS = [
  { id: "none", label: "Default", unlockedBy: null, grad: "from-slate-800 to-slate-900" },
  { id: "aurora", label: "Aurora", unlockedBy: "regimeStreak7", grad: "from-indigo-600/50 via-violet-600/40 to-fuchsia-600/40" },
  { id: "sunrise", label: "Sunrise", unlockedBy: "sessions50", grad: "from-amber-500/50 via-orange-500/40 to-rose-500/40" },
  { id: "deepSea", label: "Deep Sea", unlockedBy: "hours25", grad: "from-cyan-600/50 via-sky-600/40 to-blue-700/40" },
  { id: "midnight", label: "Midnight", unlockedBy: "streak180", grad: "from-fuchsia-600/50 via-purple-700/40 to-indigo-900/50" },
];
function isCosmeticUnlocked(option, state) {
  if (!option.unlockedBy) return true;
  const a = ACHIEVEMENTS_CATALOG.find((x) => x.id === option.unlockedBy);
  return a ? isAchievementUnlocked(a, state) : false;
}
const DEFAULT_AVATAR_ID = "fox";
function avatarById(id) {
  return (
    AVATAR_OPTIONS.find((a) => a.id === id) ||
    BONUS_AVATAR_OPTIONS.find((a) => a.id === id) ||
    AVATAR_OPTIONS[0]
  );
}

// Fixed placeholder avatars for the mock leaderboard names — "You" uses
// whatever the person picked on the Account screen instead.
const PLACEHOLDER_AVATARS = {
  Ava: "owl",
  Marcus: "tiger",
  Priya: "dolphin",
  Diego: "turtle",
  Sofia: "koala",
  Jamal: "octopus",
  Noah: "fox",
  Liam: "panda",
  Zara: "owl",
  Kenji: "tiger",
  Elena: "dolphin",
  Omar: "turtle",
  Ines: "koala",
  Theo: "octopus",
};

function Avatar({ avatarId, size = 40, imageUrl }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const avatar = avatarById(avatarId);
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: avatar.bg,
        fontSize: Math.round(size * 0.55),
        lineHeight: 1,
      }}
    >
      {avatar.emoji}
    </div>
  );
}

// Reads an uploaded image file, downsizes it to a square thumbnail on a
// canvas (keeps it small for window.storage + crisp for the avatar), and
// resolves to a JPEG data URL.
function fileToAvatarDataUrl(file, size = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// One explanatory paragraph per exercise, shown a screen at a time on the Tutorial.
const TUTORIAL_CONTENT = {
  dual:
    "A square lights up and a letter is spoken each trial. Press Position (A) if the square's position matches N steps back, and/or Sound (L) if the letter matches N steps back.",
  quad:
    "Same idea as Dual N-Back, with two more streams: shape (J) and color (F). Press any button whose stream matches N steps back.",
  rrt: "Relational Reasoning Training. Read a chain of premises about a set of items, then answer whether the final relationship holds.",
  iqnb: "Same as Quad N-Back — position, sound, color, and shape — but the color/shape stream is a Voronoi-textured blob instead of a flat-colored shape, and the level climbs in fine 0.01 increments (e.g. 4.37) instead of jumping a whole level at a time.",
  motion3d:
    "10 balls sit inside a 3D box — 5 flash gold as your targets, then everything turns the same color and drifts around. Keep your eyes on the center dot and use your peripheral vision to track the targets, then click the 5 you tracked once they freeze. Speed climbs after a perfect round and eases back down otherwise.",
};

// Rough draft placeholder leaderboard data — no real backend/accounts yet.
// dual/quad rank by N-back level (accuracy-based, with the accuracy at their
// personal-best level shown alongside it); rrt/iqnb/motion3d rank by their
// own score unit (points / decimal) even though `level` still drives which
// gem tier is shown.
const LEADERBOARD_DATA = {
  dual: [
    { name: "Ava", level: 6, accuracy: 91 },
    { name: "Marcus", level: 5, accuracy: 88 },
    { name: "You", level: 4, accuracy: 84 },
    { name: "Priya", level: 4, accuracy: 80 },
    { name: "Diego", level: 3, accuracy: 86 },
    { name: "Sofia", level: 2, accuracy: 83 },
    { name: "Jamal", level: 2, accuracy: 81 },
    { name: "Noah", level: 2, accuracy: 80 },
    { name: "Liam", level: 2, accuracy: 80 },
    { name: "Zara", level: 1, accuracy: 89 },
    { name: "Kenji", level: 1, accuracy: 85 },
    { name: "Elena", level: 1, accuracy: 83 },
    { name: "Omar", level: 1, accuracy: 81 },
    { name: "Ines", level: 1, accuracy: 80 },
    { name: "Theo", level: 1, accuracy: 80 },
  ],
  quad: [
    { name: "Priya", level: 5, accuracy: 90, score: 5.9 },
    { name: "Ava", level: 4, accuracy: 87, score: 4.87 },
    { name: "Diego", level: 4, accuracy: 82, score: 4.82 },
    { name: "You", level: 3, accuracy: 85, score: 3.85 },
    { name: "Marcus", level: 3, accuracy: 80, score: 3.8 },
    { name: "Sofia", level: 2, accuracy: 84, score: 2.84 },
    { name: "Jamal", level: 1, accuracy: 88, score: 1.88 },
    { name: "Noah", level: 1, accuracy: 84, score: 1.84 },
    { name: "Liam", level: 1, accuracy: 82, score: 1.82 },
    { name: "Zara", level: 1, accuracy: 81, score: 1.81 },
    { name: "Kenji", level: 1, accuracy: 80, score: 1.8 },
    { name: "Elena", level: 1, accuracy: 80, score: 1.8 },
    { name: "Omar", level: 1, accuracy: 80, score: 1.8 },
    { name: "Ines", level: 1, accuracy: 80, score: 1.8 },
  ],
  rrt: [
    { name: "Marcus", level: 4, score: 6.2 },
    { name: "Sofia", level: 3, score: 5.2 },
    { name: "You", level: 3, score: 5.25 },
    { name: "Ava", level: 3, score: 4.2 },
    { name: "Jamal", level: 2, score: 3.2 },
    { name: "Diego", level: 2, score: 3.25 },
    { name: "Priya", level: 1, score: 2.2 },
    { name: "Noah", level: 1, score: 2.25 },
    { name: "Liam", level: 1, score: 2.3 },
    { name: "Zara", level: 1, score: 1.2 },
    { name: "Kenji", level: 1, score: 1.25 },
    { name: "Elena", level: 1, score: 1.25 },
    { name: "Omar", level: 1, score: 1.3 },
    { name: "Ines", level: 1, score: 1.3 },
  ],
  iqnb: [
    { name: "Diego", level: 4, score: 5.23 },
    { name: "Ava", level: 3, score: 4.55 },
    { name: "Priya", level: 3, score: 4.33 },
    { name: "You", level: 2, score: 3.85 },
    { name: "Marcus", level: 2, score: 3.6 },
    { name: "Jamal", level: 2, score: 3.4 },
    { name: "Sofia", level: 1, score: 2.9 },
    { name: "Noah", level: 1, score: 2.7 },
    { name: "Liam", level: 1, score: 2.5 },
    { name: "Zara", level: 1, score: 2.3 },
    { name: "Kenji", level: 1, score: 2.1 },
    { name: "Elena", level: 1, score: 1.9 },
    { name: "Omar", level: 1, score: 1.7 },
    { name: "Ines", level: 1, score: 1.5 },
  ],
  motion3d: [
    { name: "Sofia", level: 3, score: 0.62 },
    { name: "Priya", level: 3, score: 0.58 },
    { name: "Ava", level: 2, score: 0.5 },
    { name: "Marcus", level: 2, score: 0.47 },
    { name: "You", level: 2, score: 0.45 },
    { name: "Diego", level: 1, score: 0.38 },
    { name: "Jamal", level: 1, score: 0.35 },
    { name: "Noah", level: 1, score: 0.32 },
    { name: "Liam", level: 1, score: 0.3 },
    { name: "Zara", level: 1, score: 0.28 },
    { name: "Kenji", level: 1, score: 0.25 },
    { name: "Elena", level: 1, score: 0.22 },
    { name: "Omar", level: 1, score: 0.2 },
    { name: "Ines", level: 1, score: 0.18 },
  ],
};

// Rough draft achievement catalog, organized into four groups. Each entry is
// computed live from real state (exerciseHistory / exerciseStats), not mock
// data. `progress` is optional flavor text shown while still locked; `reward`
// is optional flavor text (shown in italics) describing what unlocking it
// actually gives you — most of these rewards aren't wired up to anything yet.
const GROUP_ACCENTS = {
  Consistency: "amber",
  Performance: "violet",
  Variety: "emerald",
  Volume: "cyan",
};
// Raw hex counterparts of ACCENT_STYLES' Tailwind classes — for spots that
// need an actual CSS color value (inline conic-gradients, box-shadow glows
// via a --glow-color custom property, etc.) rather than a class name.
const ACCENT_HEX = {
  indigo: "#6366f1",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  cyan: "#22d3ee",
  rose: "#f43f5e",
  lime: "#84cc16",
  emerald: "#10b981",
};

// Generates a "reach level X for the first time" achievement for every
// level from 2 up through an n-back exercise's max, so leveling up NEVER
// lands on a level with no achievement/reward waiting for it (previously
// only a couple of checkpoints per exercise were covered, leaving gaps like
// D5B with nothing). Title is the tier name for that level (e.g. "Dual
// Adept" at level 3, "Dual Expert" at level 4) rather than a plain
// "Dual N-Back" label, so the achievement itself reads as the same rank
// system used everywhere else (gems, leaderboard, profile). `overrides`
// still lets specific levels keep a distinct id/reward (e.g. dualAdept's id
// is referenced by PROFILE_COLOR_OPTIONS, so it has to stay stable) without
// having to also hand-write a title that could drift out of sync with the
// tier table.
function nBackLevelAchievement(exerciseKey, level, overrides = {}) {
  const ex = EXERCISE_LIBRARY[exerciseKey];
  const levelTitle = ex.title.replace("N-Back", `${level}-Back`); // e.g. "Dual 5-Back"
  const exerciseName = ex.title.replace(" N-Back", ""); // e.g. "Dual"
  const tierTitle = `${exerciseName} ${gemTierFor(level).label}`; // e.g. "Dual Adept"
  const isMax = level === ex.maxN;
  return {
    id: `${exerciseKey}Level${level}`,
    group: "Performance",
    icon: exerciseKey === "dual" ? "🧠" : "🧩",
    title: tierTitle,
    description: `Reach ${levelTitle} for the first time.`,
    reward: isMax ? "New personal-best badge · max level" : "New personal-best badge",
    unlocked: (s) => (s.exerciseStats[exerciseKey]?.bestN || 0) >= level,
    progress: (s) => `Level ${Math.min(s.exerciseStats[exerciseKey]?.bestN || 0, level)}/${level}`,
    ...overrides,
  };
}
function nBackLevelAchievements(exerciseKey, overridesByLevel = {}) {
  const ex = EXERCISE_LIBRARY[exerciseKey];
  const out = [];
  for (let level = 2; level <= ex.maxN; level++) {
    out.push(nBackLevelAchievement(exerciseKey, level, overridesByLevel[level] || {}));
  }
  return out;
}

// QNB' doesn't fit nBackLevelAchievement's title templating (its title is
// "QNB'", not "<Name> N-Back"), and it tracks a fine-grained decimal level
// (e.g. 4.37) rather than a whole N — but recordQnbPrimeResult keeps
// exerciseStats.iqnb.bestN mirroring the whole-number part every time it
// crosses a new integer, so the same "reach level X for the first time"
// pattern still applies once the title/id are built by hand. Without this,
// QNB' had no achievements at all despite having its own full level-up
// flow (gems, tiers, the celebration overlay) — leveling up in it could
// never chain into an achievement celebration. Title uses the tier name
// (e.g. "QNB' Adept") for the same reason as the dual/quad achievements —
// consistent with the rank shown everywhere else, not a bare level number.
function qnbPrimeLevelAchievement(level, overrides = {}) {
  const ex = EXERCISE_LIBRARY.iqnb;
  const isMax = level === ex.maxN;
  return {
    id: `iqnbLevel${level}`,
    group: "Performance",
    icon: "🌀",
    title: `QNB' ${gemTierFor(level).label}`,
    description: `Reach QNB' level ${level} for the first time.`,
    reward: isMax ? "New personal-best badge · max level" : "New personal-best badge",
    unlocked: (s) => (s.exerciseStats.iqnb?.bestN || 0) >= level,
    progress: (s) => `Level ${Math.min(s.exerciseStats.iqnb?.bestN || 0, level)}/${level}`,
    ...overrides,
  };
}
function qnbPrimeLevelAchievements(overridesByLevel = {}) {
  const ex = EXERCISE_LIBRARY.iqnb;
  const out = [];
  for (let level = 2; level <= ex.maxN; level++) {
    out.push(qnbPrimeLevelAchievement(level, overridesByLevel[level] || {}));
  }
  return out;
}

// RRT's "level" is (premiseCount - 1) — level 1 = 2p (the starting premise
// count), level 2 = 3p, etc. — so it slots into the same gemTierFor system
// dual/quad/QNB' use for their own level-up gems. Achievements only cover
// premise-count crossings (3p, 4p, 5p, …), never the within-tier 30s→25s→20s
// time increments — recordRrtLevelUp only advances exerciseStats.rrt.bestN
// (what these check against) when the premise count itself actually goes
// up, so a run of three 20-correct-streak increments that stays at, say,
// 6p the whole time can never accidentally unlock one of these.
function rrtLevelAchievement(level, overrides = {}) {
  const ex = EXERCISE_LIBRARY.rrt;
  const premiseCount = level + 1;
  const isMax = level === ex.maxN;
  return {
    id: `rrtLevel${level}`,
    group: "Performance",
    icon: "🔗",
    title: `RRT ${gemTierFor(level).label}`,
    description: `Reach ${premiseCount} premises for the first time.`,
    reward: isMax ? "New personal-best badge · max level" : "New personal-best badge",
    unlocked: (s) => (s.exerciseStats.rrt?.bestN || 0) >= level,
    progress: (s) => `${Math.min(s.exerciseStats.rrt?.bestN || 0, level) + 1}p/${premiseCount}p`,
    ...overrides,
  };
}
function rrtLevelAchievements(overridesByLevel = {}) {
  const ex = EXERCISE_LIBRARY.rrt;
  const out = [];
  for (let level = 2; level <= ex.maxN; level++) {
    out.push(rrtLevelAchievement(level, overridesByLevel[level] || {}));
  }
  return out;
}

// Same pattern again for 3D Motion: recordMotion3dLevelUp advances
// exerciseStats.motion3d.bestN to the new integer speed tier every time the
// staircase crosses one (see MOT_TIER_STEP in Motion3DExercise — tier =
// floor(speed / 0.1), which lines up 1:1 with GEM_TIERS' 1-10 range the
// same way dual/quad/RRT's levels do). unlocked() below is a >= check
// against bestN rather than tied to the specific onLevelUp call that first
// crossed it, so if a session's first tracked crossing jumps straight from
// the starting tier to a higher one (skipping a tier in between, e.g. a
// long perfect streak), every tier up to and including bestN still shows
// unlocked — same "checked against final state, not the individual event"
// behavior the other three exercises' level achievements already rely on.
function motion3dLevelAchievement(level, overrides = {}) {
  const ex = EXERCISE_LIBRARY.motion3d;
  const isMax = level === ex.maxN;
  return {
    id: `motion3dLevel${level}`,
    group: "Performance",
    icon: "👁️",
    title: `3D Motion ${gemTierFor(level).label}`,
    description: `Reach 3D Motion speed tier ${level} for the first time.`,
    reward: isMax ? "New personal-best badge · max level" : "New personal-best badge",
    unlocked: (s) => (s.exerciseStats.motion3d?.bestN || 0) >= level,
    progress: (s) => `Tier ${Math.min(s.exerciseStats.motion3d?.bestN || 0, level)}/${level}`,
    ...overrides,
  };
}
function motion3dLevelAchievements(overridesByLevel = {}) {
  const ex = EXERCISE_LIBRARY.motion3d;
  const out = [];
  for (let level = 2; level <= ex.maxN; level++) {
    out.push(motion3dLevelAchievement(level, overridesByLevel[level] || {}));
  }
  return out;
}

const ACHIEVEMENTS_CATALOG = [
  // Consistency
  {
    id: "regimeStreak7",
    group: "Consistency",
    icon: "🔥",
    title: "7-Day Streak",
    description: "Complete your regime 7 days in a row without missing a day.",
    reward: "1 month free membership · Glow avatar border",
    unlocked: (s) => s.regimeStreak >= 7,
    progress: (s) => `${Math.min(s.regimeStreak, 7)}/7 days`,
  },
  {
    id: "streak30",
    group: "Consistency",
    icon: "🔥",
    title: "1-Month Streak",
    description: "Train 30 days in a row.",
    reward: "Unlocks the Custom regime option",
    unlocked: (s) => s.streak >= 30,
    progress: (s) => `${Math.min(s.streak, 30)}/30 days`,
  },
  {
    id: "streak180",
    group: "Consistency",
    icon: "🔥",
    title: "6-Month Streak",
    description: "Train 180 days in a row.",
    reward: "Animated aura around your avatar",
    unlocked: (s) => s.streak >= 180,
    progress: (s) => `${Math.min(s.streak, 180)}/180 days`,
  },
  {
    id: "comeback",
    group: "Consistency",
    icon: "🔁",
    title: "Comeback",
    description: "Break a streak, then come back and train again.",
    reward: '"Comeback" badge',
    unlocked: (s) => s.comeback,
  },

  // Performance
  {
    id: "grandmaster",
    group: "Performance",
    icon: "👑",
    title: "Grandmaster",
    description: `Reach Dual ${EXERCISE_LIBRARY.dual.maxN}-Back and Quad ${EXERCISE_LIBRARY.quad.maxN}-Back — max level in both.`,
    reward: "Glowing leaderboard rank",
    unlocked: (s) =>
      (s.exerciseStats.dual?.bestN || 0) >= EXERCISE_LIBRARY.dual.maxN &&
      (s.exerciseStats.quad?.bestN || 0) >= EXERCISE_LIBRARY.quad.maxN,
    progress: (s) =>
      `Dual ${Math.min(s.exerciseStats.dual?.bestN || 0, EXERCISE_LIBRARY.dual.maxN)}/${EXERCISE_LIBRARY.dual.maxN} · Quad ${Math.min(s.exerciseStats.quad?.bestN || 0, EXERCISE_LIBRARY.quad.maxN)}/${EXERCISE_LIBRARY.quad.maxN}`,
  },
  {
    id: "perfectRun",
    group: "Performance",
    icon: "💯",
    title: "Perfect Run",
    description: "Complete a session with zero misses.",
    reward: "Flawless badge",
    unlocked: (s) => Object.values(s.exerciseStats).some((v) => (v?.bestAccuracy || 0) >= 100),
  },
  {
    id: "sharpShooter",
    group: "Performance",
    icon: "🎯",
    title: "Sharp Shooter",
    description: "Score 90%+ accuracy at a given N-level.",
    unlocked: (s) => Object.values(s.exerciseStats).some((v) => (v?.bestAccuracy || 0) >= 90),
  },
  ...nBackLevelAchievements("dual", {
    3: { id: "dualAdept" },
    [EXERCISE_LIBRARY.dual.maxN]: { id: "dualMaster" },
  }),
  ...nBackLevelAchievements("quad", {
    3: { id: "quadAdept" },
    [EXERCISE_LIBRARY.quad.maxN]: { id: "quadElite" },
  }),
  ...qnbPrimeLevelAchievements({
    5: { id: "qnbPrimeAdept" },
    [EXERCISE_LIBRARY.iqnb.maxN]: { id: "qnbPrimeMaster" },
  }),
  ...rrtLevelAchievements(),
  ...motion3dLevelAchievements({
    [EXERCISE_LIBRARY.motion3d.maxN]: { id: "motion3dMaster" },
  }),

  // Volume
  {
    id: "hours5",
    group: "Volume",
    icon: "⏱️",
    title: "5 Hours Trained",
    description: "Rack up 5 hours of total training time.",
    unlocked: (s) => s.totalMsTrained >= 5 * 3600000,
    progress: (s) => `${formatHours(Math.min(s.totalMsTrained, 5 * 3600000))}/5h`,
  },
  {
    id: "hours25",
    group: "Volume",
    icon: "⏱️",
    title: "25 Hours Trained",
    description: "Rack up 25 hours of total training time.",
    unlocked: (s) => s.totalMsTrained >= 25 * 3600000,
    progress: (s) => `${formatHours(Math.min(s.totalMsTrained, 25 * 3600000))}/25h`,
  },
  {
    id: "hours100",
    group: "Volume",
    icon: "⏱️",
    title: "100 Hours Trained",
    description: "Rack up 100 hours of total training time.",
    unlocked: (s) => s.totalMsTrained >= 100 * 3600000,
    progress: (s) => `${formatHours(Math.min(s.totalMsTrained, 100 * 3600000))}/100h`,
  },
  {
    id: "hours500",
    group: "Volume",
    icon: "⏱️",
    title: "500 Hours Trained",
    description: "Rack up 500 hours of total training time.",
    unlocked: (s) => s.totalMsTrained >= 500 * 3600000,
    progress: (s) => `${formatHours(Math.min(s.totalMsTrained, 500 * 3600000))}/500h`,
  },
  {
    id: "sessions50",
    group: "Volume",
    icon: "📈",
    title: "50 Sessions",
    description: "Complete 50 training sessions.",
    unlocked: (s) => s.totalSessions >= 50,
    progress: (s) => `${Math.min(s.totalSessions, 50)}/50`,
  },
  {
    id: "sessions200",
    group: "Volume",
    icon: "📈",
    title: "200 Sessions",
    description: "Complete 200 training sessions.",
    unlocked: (s) => s.totalSessions >= 200,
    progress: (s) => `${Math.min(s.totalSessions, 200)}/200`,
  },
  {
    id: "sessions1000",
    group: "Volume",
    icon: "📈",
    title: "1000 Sessions",
    description: "Complete 1000 training sessions.",
    unlocked: (s) => s.totalSessions >= 1000,
    progress: (s) => `${Math.min(s.totalSessions, 1000)}/1000`,
  },

  // Variety
  {
    id: "wellRounded",
    group: "Variety",
    icon: "🎭",
    title: "Well-Rounded",
    description: "Train both Dual N-Back and Quad N-Back regularly.",
    reward: "Split-tone avatar",
    unlocked: (s) =>
      (s.exerciseStats.dual?.sessions || 0) >= 10 && (s.exerciseStats.quad?.sessions || 0) >= 10,
    progress: (s) =>
      `${Math.min(Math.min(s.exerciseStats.dual?.sessions || 0, s.exerciseStats.quad?.sessions || 0), 10)}/10 each`,
  },
];

// Whether an achievement counts as unlocked — real progress via the
// achievement's own `unlocked()` function, OR force-unlocked through the
// per-badge 🧪 Simulate button (tracked in state.simulatedUnlockedIds, which
// only ever exists on the signed-in player's own achievementState — mock
// profiles for other leaderboard people never carry it).
function isAchievementUnlocked(a, state) {
  return !!state?.simulatedUnlockedIds?.has(a.id) || a.unlocked(state);
}

// Generates a plausible achievementState for a mock leaderboard person, reusing
// whatever level/accuracy/score they already have across LEADERBOARD_DATA plus
// a small deterministic (name-seeded) spread for streak/hours/sessions/comeback —
// so every leaderboard profile ends up with a believably partial set of badges,
// computed through the exact same `unlocked()` functions real players use.
function mockAchievementStateFor(name) {
  const exerciseStats = {};
  Object.entries(LEADERBOARD_DATA).forEach(([exKey, rows]) => {
    const row = rows.find((r) => r.name === name);
    if (!row) return;
    const ex = EXERCISE_LIBRARY[exKey];
    exerciseStats[exKey] = {
      bestN: row.level,
      bestAccuracy: ex.scoreType === "accuracy" ? row.accuracy : row.score,
      sessions: 6 + row.level * 5,
    };
  });
  const seed = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const totalSessions = Object.values(exerciseStats).reduce((sum, v) => sum + v.sessions, 0);
  return {
    streak: 1 + (seed % 25),
    exerciseStats,
    totalSessions,
    totalMsTrained: totalSessions * (16 + (seed % 22)) * 60000,
    comeback: seed % 3 === 0,
  };
}

// A few achievement rewards are literally an avatar decoration (see the
// `reward` flavor text on regimeStreak7 / streak180 / wellRounded above) —
// this turns an achievementState into which frame tier actually applies,
// highest first, so unlocking the badge visibly changes your avatar everywhere.
function avatarFrameTier(state) {
  if (!state) return "none";
  const unlockedIds = new Set(
    ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, state)).map((a) => a.id)
  );
  if (unlockedIds.has("streak180")) return "aura";
  if (unlockedIds.has("wellRounded")) return "splitTone";
  if (unlockedIds.has("regimeStreak7")) return "glow";
  return "none";
}

// The Grandmaster achievement's reward is a glowing leaderboard rank —
// this is the shared check used to decide whether to render that glow on
// a given leaderboard row (works for "you" and mock profiles alike).
function hasLeaderboardGlow(state) {
  if (!state) return false;
  const a = ACHIEVEMENTS_CATALOG.find((x) => x.id === "grandmaster");
  return a ? isAchievementUnlocked(a, state) : false;
}

// Wraps an <Avatar> with the ring/glow/animation earned by its unlocked
// achievement rewards. "none" renders the avatar untouched.
function AvatarFrame({ tier, children }) {
  if (!tier || tier === "none") return <>{children}</>;
  if (tier === "aura") {
    return (
      <div
        className="rounded-full shrink-0"
        style={{
          padding: 4,
          background:
            "conic-gradient(from 90deg, #f59e0b, #ec4899, #8b5cf6, #06b6d4, #f59e0b)",
          animation: "auraPulseGlow 2.4s ease-in-out infinite",
        }}
      >
        <div className="rounded-full bg-slate-950 p-[2px]">{children}</div>
      </div>
    );
  }
  if (tier === "splitTone") {
    return (
      <div
        className="rounded-full shrink-0"
        style={{
          padding: 3,
          background:
            "linear-gradient(135deg, #34d399 0%, #34d399 50%, #22d3ee 50%, #22d3ee 100%)",
        }}
      >
        <div className="rounded-full bg-slate-950 p-[2px]">{children}</div>
      </div>
    );
  }
  // glow
  return (
    <div
      className="rounded-full shrink-0"
      style={{
        padding: 3,
        background: "#fbbf24",
        boxShadow: "0 0 12px 2px rgba(251,191,36,0.55)",
      }}
    >
      <div className="rounded-full bg-slate-950 p-[2px]">{children}</div>
    </div>
  );
}

// Compact badge grid — every achievement as a small icon tile, unlocked ones
// lit up in their group color, locked ones greyed out. Used on the Account
// page (your own badges) and on any leaderboard profile (their badges).
// Hovering a tile shows its description in a small tooltip; clicking one
// opens an in-page detail card (via onSelectBadge) — no navigation away.
function BadgeGrid({ state, onSeeAll, onSelectBadge, hideHeader }) {
  const unlockedCount = ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, state)).length;
  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="text-lg text-slate-300">
            Badges{" "}
            <span className="text-slate-500 text-base font-normal">
              ({unlockedCount}/{ACHIEVEMENTS_CATALOG.length})
            </span>
          </div>
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              See all ›
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        {ACHIEVEMENTS_CATALOG.map((a) => {
          const isUnlocked = isAchievementUnlocked(a, state);
          const groupAccent = ACCENT_STYLES[GROUP_ACCENTS[a.group]];
          return (
            <button
              key={a.id}
              onClick={() => onSelectBadge?.(a)}
              className="group relative flex flex-col items-center gap-2 text-center"
            >
              <div
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs leading-snug text-slate-200 shadow-lg opacity-0 scale-95 transition-all duration-100 group-hover:opacity-100 group-hover:scale-100 z-20"
              >
                {a.description}
              </div>
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border transition-transform group-hover:scale-105 ${
                  isUnlocked
                    ? `bg-gradient-to-br ${groupAccent.grad} ${groupAccent.borderStrong} shadow-lg shadow-black/30`
                    : "bg-slate-900 border-slate-800 grayscale opacity-40"
                }`}
              >
                {a.icon}
              </div>
              <div
                className={`text-xs leading-tight ${
                  isUnlocked ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {a.title}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NBackSessionApp() {
  const [mainView, setMainView] = useState("regime"); // "regime" | "home" | "app" | "leaderboard" | "profile" | "tutorial" | "achievements"
  const [leaderboardTab, setLeaderboardTab] = useState("dual"); // "dual" | "quad" | "rrt"
  const [regimeKey, setRegimeKey] = useState(null); // "low" | "medium" | "high"
  const [activeExercises, setActiveExercises] = useState(() =>
    buildRegimeExercises(REGIMES[0])
  );
  const activeExercisesRef = useRef(activeExercises);
  useEffect(() => {
    activeExercisesRef.current = activeExercises;
  }, [activeExercises]);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercise = activeExercises[exerciseIndex] || activeExercises[0];
  const exerciseIndexRef = useRef(0);
  useEffect(() => {
    exerciseIndexRef.current = exerciseIndex;
  }, [exerciseIndex]);

  const [screen, setScreen] = useState("setup"); // setup | running | results
  const [n, setN] = useState(exercise.defaultN);
  const trialCount = trialsForLevel(n);
  // Testing-only control: how scrambled the RRT premise viewing order is.
  // 0 = natural chain order (easy), 1 = actively avoids putting two
  // item-sharing premises back to back (hard). See the slider above the
  // RRT exercise box.
  const [rrtScrambleFactor, setRrtScrambleFactor] = useState(0.5);
  const [switchNotice, setSwitchNotice] = useState(false);
  // Chance (0-32%) that a non-match trial is a "lure" reusing the item from
  // n-1 or n+1 trials back instead of a fresh one, so it superficially
  // resembles a recent repeat without actually being the n-back match.
  // Defaults on at 12% for every n-back exercise so sessions actually
  // include confusable near-misses out of the box. QNB' overrides this
  // per-run with its own progression (see qnbPrimeSettingsFor) instead of
  // using this shared value.
  // Not persisted; resets to this default on reload. Stored as a fraction
  // (0-0.32) internally, shown as a whole-percent slider in the UI.
  const [interference, setInterference] = useState(0.12);
  // QNB's own level — a float like 4.37 (whole N + a 0.00-0.99 sub-step),
  // persisted separately from the plain-integer `exerciseLevels` used by
  // every other exercise since it needs the fractional part. Drives which
  // whole N is played (Math.floor) and which row of qnbPrimeSettingsFor
  // applies (the 0-99 step) each run; moved by qnbPrimeLevelDelta after
  // each session instead of the generic pass/fail recordSessionResult.
  const [qnbPrimeLevel, setQnbPrimeLevelState] = useState(4.0);
  const qnbPrimeLevelRef = useRef(4.0);
  useEffect(() => {
    qnbPrimeLevelRef.current = qnbPrimeLevel;
  }, [qnbPrimeLevel]);
  const [qnbPrimeLastDelta, setQnbPrimeLastDelta] = useState(null); // most recent qnbPrimeLevelDelta applied, shown on the Results screen for QNB'
  // Settings derived from qnbPrimeLevel for whichever run is currently in
  // flight — captured once at startTask time so a mid-session level change
  // (there isn't one, but just in case) can't retroactively alter a run
  // already underway. runTrial reads this ref instead of the static
  // EXERCISE_LIBRARY.iqnb.stimMs.
  const qnbPrimeRunSettingsRef = useRef(null);
  const [rrtStage, setRrtStage] = useState("setup"); // mirrors RRTExercise's internal stage, so the shared header can hide "← Home" / "Exercise X of Y" once RRT is actually running
  const [motion3dStage, setMotion3dStage] = useState("setup"); // same idea, for Motion3DExercise
  useEffect(() => {
    setRrtStage("setup");
  }, [exerciseIndex]);

  const [sequence, setSequence] = useState({});
  const [index, setIndex] = useState(0);
  const [activeCell, setActiveCell] = useState(null);
  const [results, setResults] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [lowScoreStreak, setLowScoreStreak] = useState({});
  const [levelChangeNotice, setLevelChangeNotice] = useState(null); // { direction: "down" } — level dropped after 3 failing runs
  const [newPRBanners, setNewPRBanners] = useState({}); // { [exerciseKey]: title } — shown as boxes on the results screen only, cleared when that exercise is (re)started
  const [unlockInfo, setUnlockInfo] = useState(null); // { exerciseKey, level, title } — drives the "new emblem unlocked" overlay (see the fixed-position block near the other celebration overlays, not a mainView)
  const [profileTarget, setProfileTarget] = useState(null); // "you" | <leaderboard name> | null — who the Profile screen is showing
  const [achievementCelebrationQueue, setAchievementCelebrationQueue] = useState([]); // ACHIEVEMENTS_CATALOG entries just unlocked, shown one at a time as a full-screen celebration
  const [simulatedUnlockedIds, setSimulatedUnlockedIds] = useState(() => new Set()); // achievement ids force-unlocked via the per-badge 🧪 Simulate button, independent of real progress
  const [badgeDetail, setBadgeDetail] = useState(null); // { achievement, state } | null — clicked badge shown in an in-page detail modal
  const [streakCardOpen, setStreakCardOpen] = useState(false); // home screen's 🔥 streak badge — opens a small popup with the week view
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [errorLog, setErrorLog] = useState([]); // loaded fresh whenever Account opens — see Diagnostics card below
  const unlockedAchievementIdsRef = useRef(null); // baseline set of unlocked achievement ids, used to detect newly-unlocked ones
  const [hasHydrated, setHasHydrated] = useState(false); // true once persisted stats have had a moment to load, so we don't "celebrate" badges the person already had

  const timeoutRef = useRef(null);
  const respondedRef = useRef({});
  const currentMatchRef = useRef({});
  const runGenerationRef = useRef(0);

  const sessionTimersRef = useRef({}); // { [exerciseKey]: timeoutId }
  const sessionStartedRef = useRef({}); // { [exerciseKey]: true }
  const sessionTimerStartRef = useRef({}); // { [exerciseKey]: timestamp } — when that exercise's session timer began, for the "time left" readout

  const [exerciseElapsedMs, setExerciseElapsedMs] = useState({}); // { [key]: ms }, updated once per finished/aborted session
  const [exerciseStats, setExerciseStats] = useState({}); // { [key]: { sessions, totalAccuracy, bestAccuracy, bestN, lastAccuracy } } — persisted long-term via window.storage
  const exerciseStatsRef = useRef({}); // mirrors exerciseStats, read synchronously to know the PRE-session bestN for "new PR" checks
  useEffect(() => {
    exerciseStatsRef.current = exerciseStats;
  }, [exerciseStats]);
  const [exerciseHistory, setExerciseHistory] = useState({}); // { [key]: [{ ts, accuracy, n }] } — per-session log, persisted, feeds the graph
  const [exerciseLevels, setExerciseLevels] = useState({}); // { [key]: n } — current level per exercise, persisted, feeds the homepage
  const exerciseLevelsRef = useRef({}); // mirrors exerciseLevels, read synchronously wherever a new exercise starts/resumes so it picks up the level actually reached, not the exercise's static defaultN
  useEffect(() => {
    exerciseLevelsRef.current = exerciseLevels;
  }, [exerciseLevels]);
  const [regimeCompletionDates, setRegimeCompletionDatesState] = useState([]); // persisted — toDateString() entries for each day the person completed their FULL regime, feeds the 7-day regime-streak achievement
  const [regimeTrainingDates, setRegimeTrainingDatesState] = useState({ low: [], medium: [], high: [] }); // persisted — per-regime toDateString() entries for each day the person completed that regime's FULL session; drives each regime's automatic train/rest schedule (see REGIME_SCHEDULE)
  const [regimeStreakBrokenAt, setRegimeStreakBrokenAtState] = useState({}); // persisted — { [regimeKey]: dateString } set when the person trains through a confirmed rest-day warning, severing that regime's scheduled streak at that date
  const [streakBrokenAt, setStreakBrokenAtState] = useState(null); // persisted — dateString set when the person confirms switching regimes with a live daily streak, severing the general 🔥 streak (currentStreakDays) at that date
  const [restDayConfirm, setRestDayConfirm] = useState(null); // { regimeKey, action } while the "train on a rest day?" popup is open, else null
  const regimeKeyRef = useRef(null); // mirrors regimeKey, read synchronously by callbacks (markRegimeCompletedToday) whose closures don't otherwise see the latest value
  useEffect(() => {
    regimeKeyRef.current = regimeKey;
  }, [regimeKey]);
  const [overviewView, setOverviewView] = useState("summary"); // "summary" | "graph"
  const [statsDisplay, setStatsDisplay] = useState("chart"); // "chart" | "spreadsheet" — which form the stats/graph screen shows session history in
  const [overviewSource, setOverviewSource] = useState("training"); // "training" | "home" — controls which time-trained stat the Session Overview screen shows
  const [selectedAvatarId, setSelectedAvatarIdState] = useState(DEFAULT_AVATAR_ID); // persisted via window.storage, feeds the Account screen + leaderboard "You" row
  const [customAvatarImage, setCustomAvatarImageState] = useState(null); // data URL string | null — an uploaded photo, takes priority over the preset avatar when set
  const [displayName, setDisplayNameState] = useState("You"); // persisted via window.storage, feeds the Account screen + leaderboard "You" row
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [bio, setBioState] = useState(""); // persisted — short profile description, shown on the Profile screen
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [selectedFrameId, setSelectedFrameIdState] = useState("none"); // persisted — which unlocked avatar frame is actively equipped (Club Penguin-style, pick one even if more are unlocked)
  const [selectedColorId, setSelectedColorIdState] = useState("indigo"); // persisted — profile accent color theme
  const [selectedBackgroundId, setSelectedBackgroundIdState] = useState("none"); // persisted — profile banner background
  const [featuredBadgeId, setFeaturedBadgeIdState] = useState(null); // persisted — one badge pinned front-and-center on the profile
  const [binauralBeatsEnabled, setBinauralBeatsEnabledState] = useState(false); // persisted — toggle shown during audio-modality exercises
  const [rrtBranchingEnabled, setRrtBranchingEnabledState] = useState(true); // persisted — default ON; lets one RRT item be the object of 3+ premises instead of capping every item at 2
  const [badgesExpanded, setBadgesExpanded] = useState(false); // Account page — Badges row toggles the grid open in place
  const [customizeExpanded, setCustomizeExpanded] = useState(false); // Account page — Customize profile row toggles avatar/frame/color/background/featured-badge pickers open in place
  const [profileBadgesExpanded, setProfileBadgesExpanded] = useState(false); // Profile page — same toggle pattern as Account
  const [membershipPlan, setMembershipPlan] = useState("monthly"); // "monthly" | "annual" | "canceled" — mock only, no real billing yet
  const [seenTutorialRegimes, setSeenTutorialRegimesState] = useState({}); // { [regimeKey]: true } — persisted; tutorial shown once PER regime since each has different exercises
  const [tutorialStep, setTutorialStep] = useState(0); // index into that regime's exercise order, walked through via the tutorial's Next button
  const currentRunStartRef = useRef(null);
  const avatarFileInputRef = useRef(null);
  const MAX_HISTORY_ENTRIES = 200;

  // Load previously saved best/avg accuracy stats + session history (persists across sessions/days)
  useEffect(() => {
    if (!window.storage) {
      setHasHydrated(true);
      return;
    }
    const loads = Object.values(EXERCISE_LIBRARY).flatMap((e) => [
      (async () => {
        try {
          const res = await window.storage.get(`stats-${e.key}`, false);
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            if (e.key === "motion3d") {
              // See MOT_TIER_SCHEMA_VERSION — a bestN saved under an older
              // speed/tier scale doesn't mean what it looks like under the
              // current one, so it's discarded (not trusted) rather than
              // read as real progress.
              const schemaRes = await window.storage.get("motion3d-tier-schema-version", false).catch(() => null);
              const savedSchema = schemaRes && schemaRes.value ? JSON.parse(schemaRes.value) : null;
              if (savedSchema !== MOT_TIER_SCHEMA_VERSION) {
                const resetStat = { sessions: 0, totalAccuracy: 0, bestAccuracy: 0, bestN: 0 };
                setExerciseStats((prev) => ({ ...prev, motion3d: resetStat }));
                safeStorageSet("stats-motion3d", JSON.stringify(resetStat), false);
                window.storage
                  .set("motion3d-tier-schema-version", JSON.stringify(MOT_TIER_SCHEMA_VERSION), false)
                  .catch(() => {});
                return;
              }
            }
            setExerciseStats((prev) => ({ ...prev, [e.key]: parsed }));
          }
        } catch (err) {
          // no saved stats yet for this exercise
        }
      })(),
      (async () => {
        try {
          const res = await window.storage.get(`history-${e.key}`, false);
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            setExerciseHistory((prev) => ({ ...prev, [e.key]: parsed }));
          }
        } catch (err) {
          // no saved history yet for this exercise
        }
      })(),
      (async () => {
        try {
          const res = await window.storage.get(`level-${e.key}`, false);
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            setExerciseLevels((prev) => ({ ...prev, [e.key]: parsed }));
          }
        } catch (err) {
          // no saved level yet for this exercise
        }
      })(),
    ]);
    // Only treat achievements as measurable once every persisted stat/history
    // load has actually landed — a fixed timer here (the previous approach)
    // can fire before a slower load resolves, capturing an incomplete
    // baseline and then spuriously "unlocking" an already-earned achievement
    // the moment that late data finally arrives, regardless of which
    // exercise the person happens to be playing when it does. A generous
    // fallback timeout is raced alongside it so hydration can't hang forever
    // if storage is unavailable or a call never settles.
    let settled = false;
    const markHydrated = () => {
      if (settled) return;
      settled = true;
      setHasHydrated(true);
    };
    Promise.allSettled(loads).then(markHydrated);
    const fallback = setTimeout(markHydrated, 6000);
    (async () => {
      try {
        const res = await window.storage.get("selected-avatar", false);
        if (res && res.value) {
          setSelectedAvatarIdState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved avatar yet
      }
      try {
        const res = await window.storage.get("custom-avatar-image", false);
        if (res && res.value) {
          setCustomAvatarImageState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved custom photo yet
      }
      try {
        const res = await window.storage.get("display-name", false);
        if (res && res.value) {
          setDisplayNameState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved name yet
      }
      try {
        const res = await window.storage.get("bio", false);
        if (res && res.value) {
          setBioState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved bio yet
      }
      try {
        const res = await window.storage.get("seen-tutorial-regimes", false);
        if (res && res.value) {
          setSeenTutorialRegimesState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved tutorial flags yet
      }
      try {
        const res = await window.storage.get("selected-frame", false);
        if (res && res.value) {
          setSelectedFrameIdState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved frame yet
      }
      try {
        const res = await window.storage.get("selected-color", false);
        if (res && res.value) {
          setSelectedColorIdState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved color yet
      }
      try {
        const res = await window.storage.get("selected-background", false);
        if (res && res.value) {
          setSelectedBackgroundIdState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved background yet
      }
      try {
        const res = await window.storage.get("featured-badge", false);
        if (res && res.value) {
          setFeaturedBadgeIdState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved featured badge yet
      }
      try {
        const res = await window.storage.get("binaural-beats-enabled", false);
        if (res && res.value) {
          setBinauralBeatsEnabledState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved binaural setting yet
      }
      try {
        const res = await window.storage.get("rrt-branching-enabled", false);
        if (res && res.value) {
          setRrtBranchingEnabledState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved rrt-branching setting yet — stays on (the useState default)
      }
      try {
        const res = await window.storage.get("regime-completion-dates", false);
        if (res && res.value) {
          setRegimeCompletionDatesState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved regime completion dates yet
      }
      try {
        const res = await window.storage.get("regime-training-dates", false);
        if (res && res.value) {
          setRegimeTrainingDatesState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved per-regime training dates yet
      }
      try {
        const res = await window.storage.get("regime-streak-broken-at", false);
        if (res && res.value) {
          setRegimeStreakBrokenAtState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved regime streak breaks yet
      }
      try {
        const res = await window.storage.get("streak-broken-at", false);
        if (res && res.value) {
          setStreakBrokenAtState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved streak break yet
      }
      try {
        const res = await window.storage.get("history-_streakTest", false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setExerciseHistory((prev) => ({ ...prev, _streakTest: parsed }));
        }
      } catch (err) {
        // no saved streak-test history yet
      }
      try {
        const res = await window.storage.get("qnbprime-level", false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setQnbPrimeLevelState(parsed);
          qnbPrimeLevelRef.current = parsed;
        }
      } catch (err) {
        // no saved QNB' level yet
      }
    })();
  }, []);

  // Shared by both the passive background effect below and the level-up
  // modal's "Accept" button — scans for any achievement that just became
  // unlocked and, if so, queues it. Calling this explicitly again on Accept
  // (in addition to the effect firing on its own) is a deliberate belt-and-
  // suspenders: it guarantees the achievement is queued and ready to chain
  // in immediately once the level-up celebration closes, rather than
  // depending on exactly when React happens to run the passive effect
  // relative to that click.
  const checkForNewAchievements = useCallback((statsOverride) => {
    // Accepts an explicit statsOverride so a caller that just computed a
    // brand-new exerciseStats object itself (e.g. recordSessionResult, right
    // when it bumps bestN for a level-up) can check achievements against
    // those exact numbers synchronously, in the same call, instead of
    // waiting on this component's own `exerciseStats` state to re-render —
    // which is what let the achievement celebration silently miss its
    // chance to queue before "Accept" was clicked. Falls back to the
    // current state when called with no argument (e.g. the passive
    // background check below, or the badge-detail screen's re-check).
    const stats = statsOverride || exerciseStats;
    const state = {
      streak: currentStreakDays(exerciseHistory, streakBrokenAt),
      regimeStreak: currentRegimeStreakDays(regimeCompletionDates),
      exerciseStats: stats,
      totalSessions: Object.values(stats).reduce((sum, v) => sum + (v?.sessions || 0), 0),
      totalMsTrained: msTrainedTotal(exerciseHistory),
      comeback: hasComebackFromBrokenStreak(exerciseHistory),
    };
    const nowUnlocked = new Set(
      ACHIEVEMENTS_CATALOG.filter((a) => a.unlocked(state)).map((a) => a.id)
    );
    if (unlockedAchievementIdsRef.current === null) {
      // First measurement post-hydration — this is the baseline, not a "win".
      unlockedAchievementIdsRef.current = nowUnlocked;
      return;
    }
    const prevUnlocked = unlockedAchievementIdsRef.current;
    const newlyUnlocked = ACHIEVEMENTS_CATALOG.filter(
      (a) => nowUnlocked.has(a.id) && !prevUnlocked.has(a.id)
    );
    if (newlyUnlocked.length > 0) {
      setAchievementCelebrationQueue((q) => {
        const existingIds = new Set(q.map((a) => a.id));
        const toAdd = newlyUnlocked.filter((a) => !existingIds.has(a.id));
        return toAdd.length > 0 ? [...q, ...toAdd] : q;
      });
    }
    unlockedAchievementIdsRef.current = nowUnlocked;
  }, [exerciseStats, exerciseHistory, regimeCompletionDates, streakBrokenAt]);

  useEffect(() => {
    if (!hasHydrated) return;
    checkForNewAchievements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseStats, exerciseHistory, regimeCompletionDates, streakBrokenAt, hasHydrated]);

  // Appends to a running, timestamped feedback log in storage — nothing
  // fancier than that exists yet (no inbox/email), but it's genuinely
  // persisted rather than just a fake "thanks!" toast.
  const submitFeedback = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (window.storage) {
      try {
        const res = await window.storage.get("feedback-log", false);
        const existing = res && res.value ? JSON.parse(res.value) : [];
        const updated = [...existing, { text: trimmed, ts: Date.now() }];
        await safeStorageSet("feedback-log", JSON.stringify(updated), false);
      } catch (err) {
        // storage unavailable — feedback still shows as submitted locally
        logClientError("submitFeedback", err);
      }
    }
  }, []);

  // Diagnostics (Account screen) reads the error log fresh each time the
  // person opens Account, rather than keeping it live in state the whole
  // session — errors can be logged from anywhere (including outside React,
  // e.g. the window error/rejection listeners), so a snapshot-on-open is
  // simpler than trying to keep a subscription in sync with every writer.
  useEffect(() => {
    if (mainView !== "account" || !window.storage) return;
    window.storage
      .get(ERROR_LOG_KEY, false)
      .then((res) => {
        try {
          setErrorLog(res && res.value ? JSON.parse(res.value) : []);
        } catch {
          setErrorLog([]);
        }
      })
      .catch(() => setErrorLog([]));
  }, [mainView]);

  const clearErrorLog = useCallback(() => {
    setErrorLog([]);
    safeStorageSet(ERROR_LOG_KEY, JSON.stringify([]), false);
  }, []);

  const setSelectedAvatarId = useCallback((id) => {
    setSelectedAvatarIdState(id);
    if (window.storage) {
      safeStorageSet("selected-avatar", JSON.stringify(id), false);
    }
    // Picking a preset avatar replaces any uploaded photo.
    setCustomAvatarImageState(null);
    if (window.storage) {
      safeStorageDelete("custom-avatar-image", false);
    }
  }, []);

  const [avatarUploadError, setAvatarUploadError] = useState("");
  const handleAvatarUpload = useCallback(async (file) => {
    if (!file) return;
    setAvatarUploadError("");
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setCustomAvatarImageState(dataUrl);
      if (window.storage) {
        await safeStorageSet("custom-avatar-image", JSON.stringify(dataUrl), false);
      }
    } catch (err) {
      setAvatarUploadError("Couldn't load that image — try a different file.");
    }
  }, []);
  const removeCustomAvatar = useCallback(() => {
    setCustomAvatarImageState(null);
    if (window.storage) {
      safeStorageDelete("custom-avatar-image", false);
    }
  }, []);

  const setDisplayName = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDisplayNameState(trimmed);
    if (window.storage) {
      safeStorageSet("display-name", JSON.stringify(trimmed), false);
    }
  }, []);

  const setBio = useCallback((text) => {
    const trimmed = text.trim().slice(0, 100);
    setBioState(trimmed);
    if (window.storage) {
      safeStorageSet("bio", JSON.stringify(trimmed), false);
    }
  }, []);

  const setSelectedFrameId = useCallback((id) => {
    setSelectedFrameIdState(id);
    if (window.storage) {
      safeStorageSet("selected-frame", JSON.stringify(id), false);
    }
  }, []);

  const setSelectedColorId = useCallback((id) => {
    setSelectedColorIdState(id);
    if (window.storage) {
      safeStorageSet("selected-color", JSON.stringify(id), false);
    }
  }, []);

  const setSelectedBackgroundId = useCallback((id) => {
    setSelectedBackgroundIdState(id);
    if (window.storage) {
      safeStorageSet("selected-background", JSON.stringify(id), false);
    }
  }, []);

  const setFeaturedBadgeId = useCallback((id) => {
    setFeaturedBadgeIdState(id);
    if (window.storage) {
      safeStorageSet("featured-badge", JSON.stringify(id), false);
    }
  }, []);

  const setBinauralBeatsEnabled = useCallback((val) => {
    setBinauralBeatsEnabledState(val);
    if (window.storage) {
      safeStorageSet("binaural-beats-enabled", JSON.stringify(val), false);
    }
  }, []);

  const setRrtBranchingEnabled = useCallback((val) => {
    setRrtBranchingEnabledState(val);
    if (window.storage) {
      safeStorageSet("rrt-branching-enabled", JSON.stringify(val), false);
    }
  }, []);

  // Only actually plays while a trial is running — stops itself on setup/
  // results screens rather than droning on in the menus.
  const { unlock: unlockBinauralAudio, audioError: binauralAudioError } = useBinauralBeats(
    binauralBeatsEnabled && screen === "running"
  );

  const setQnbPrimeLevel = useCallback((val) => {
    qnbPrimeLevelRef.current = val;
    setQnbPrimeLevelState(val);
    if (window.storage) {
      safeStorageSet("qnbprime-level", JSON.stringify(val), false);
    }
  }, []);

  const setExerciseLevel = useCallback((key, newN) => {
    setExerciseLevels((prev) => ({ ...prev, [key]: newN }));
    if (window.storage) {
      safeStorageSet(`level-${key}`, JSON.stringify(newN), false);
    }
  }, []);

  // Applies a finished QNB' session's result: moves qnbPrimeLevel by
  // qnbPrimeLevelDelta(accuracy) instead of the whole-level pass/fail
  // recordSessionResult every other exercise uses, and keeps the plain-int
  // exerciseLevels/exerciseStats.bestN mirrors (used by the Home tile, gem
  // tier, achievements, etc.) in sync with the new whole part. This is the
  // one place both a real QNB' session (runTrial) and the setup screen's
  // 🧪 simulate-a-run buttons both go through — so the stats bump and
  // achievement check live here, not duplicated (or missing) in each
  // caller. Returns the delta so the results screen can show what just
  // happened.
  const recordQnbPrimeResult = useCallback((overallAcc) => {
    const prevLevel = qnbPrimeLevelRef.current;
    const delta = qnbPrimeLevelDelta(overallAcc);
    const nextLevel = Math.max(1, Math.round((prevLevel + delta) * 100) / 100);
    setQnbPrimeLevel(nextLevel);
    setExerciseLevel("iqnb", Math.floor(nextLevel));

    // Built off exerciseStatsRef.current and passed straight into
    // checkForNewAchievements synchronously (rather than only relying on
    // the passive background effect) so an achievement gated on bestN is
    // guaranteed to be queued in the same pass that crosses its threshold,
    // whether that happens via a real session or a simulated one.
    const prevStat = exerciseStatsRef.current.iqnb || {
      sessions: 0,
      totalAccuracy: 0,
      bestAccuracy: 0,
      bestN: 0,
    };
    const newStat = {
      sessions: prevStat.sessions + 1,
      totalAccuracy: prevStat.totalAccuracy + nextLevel,
      bestAccuracy: Math.max(prevStat.bestAccuracy, nextLevel),
      bestN: Math.max(prevStat.bestN, Math.floor(nextLevel)),
      lastAccuracy: nextLevel,
    };
    if (window.storage) {
      safeStorageSet("stats-iqnb", JSON.stringify(newStat), false);
    }
    const finalStats = { ...exerciseStatsRef.current, iqnb: newStat };
    setExerciseStats(finalStats);
    checkForNewAchievements(finalStats);

    // Crossing a whole number (e.g. 4.99 → 5.00) is QNB's equivalent of
    // leveling up in any other exercise — fires the same shared full-screen
    // celebration overlay recordSessionResult uses for DNB/Quad, every time
    // it happens (climbing back to a whole level reached before still
    // celebrates, not just new personal bests — same rule as everywhere
    // else), not gated to the first time it's ever hit.
    if (Math.floor(nextLevel) > Math.floor(prevLevel)) {
      const ex = EXERCISE_LIBRARY.iqnb;
      const wholeLevel = Math.floor(nextLevel);
      const title = `${ex.title} ${nextLevel.toFixed(2)}`;
      const isNewPR = wholeLevel > prevStat.bestN;
      setUnlockInfo({ exerciseKey: "iqnb", level: wholeLevel, title, isNewPR });
    }
    return delta;
  }, [setQnbPrimeLevel, setExerciseLevel, checkForNewAchievements]);

  // Called on EVERY RRT difficulty increment (every 20-correct streak) —
  // both the within-tier round-length steps (30s→25s→20s) and the
  // premise-count steps. Only bumps exerciseStats.rrt.bestN — and therefore
  // only counts as a "new personal record" / can unlock an rrtLevel
  // achievement — when `level` (derived from premise count, not round
  // length) has actually gone up. The generic level-up gem celebration
  // still shows every time either way, same as the rest of RRT already did.
  const recordRrtLevelUp = useCallback(
    (level, title) => {
      const prevStat = exerciseStatsRef.current.rrt || {
        sessions: 0,
        totalAccuracy: 0,
        bestAccuracy: 0,
        bestN: 0,
      };
      const isNewPR = level > prevStat.bestN;
      if (isNewPR) {
        const newStat = {
          ...prevStat,
          bestN: level,
          bestAccuracy: Math.max(prevStat.bestAccuracy, level),
        };
        if (window.storage) {
          safeStorageSet("stats-rrt", JSON.stringify(newStat), false);
        }
        const finalStats = { ...exerciseStatsRef.current, rrt: newStat };
        setExerciseStats(finalStats);
        checkForNewAchievements(finalStats);
      }
      setUnlockInfo({ exerciseKey: "rrt", level, title, isNewPR });
    },
    [checkForNewAchievements]
  );

  // Same fix as recordMotion3dSessionEnd below, for the same reason: RRT
  // only ever advanced exerciseStats.rrt.bestN (via recordRrtLevelUp above,
  // on a premise-count PR) but never logged an actual session into
  // exerciseHistory.rrt — so the Overview graph/spreadsheet and the
  // Stats screen's avg score both showed nothing for RRT no matter how
  // much of it got played, even though the level-up celebrations and
  // achievements worked fine. Called once an RRT session actually ends
  // (natural session-duration cutoff), from inside RRTExercise's
  // triggerFlash — see the sessionBudgetMs check there. `accuracy` here
  // follows the same "points" convention formatScoreValue expects for RRT
  // (premise count in the whole part, round length in seconds encoded as
  // the fractional part — e.g. 7.30 → "7p 30s"), and `n` is RRT's bestN-style
  // level (premiseCount - 1), matching what recordRrtLevelUp already uses.
  const recordRrtSessionEnd = useCallback(
    ({ premiseCount, roundSeconds, levelReached, durationMs, streakReached }) => {
      const scoreValue = premiseCount + roundSeconds / 100;
      const prevStat = exerciseStatsRef.current.rrt || {
        sessions: 0,
        totalAccuracy: 0,
        bestAccuracy: 0,
        bestN: 0,
        bestStreak: 0,
      };
      const isNewBest = scoreValue >= prevStat.bestAccuracy;
      const newStat = {
        ...prevStat,
        sessions: prevStat.sessions + 1,
        totalAccuracy: prevStat.totalAccuracy + scoreValue,
        bestAccuracy: Math.max(prevStat.bestAccuracy, scoreValue),
        // Paired with bestAccuracy rather than tracked as its own all-time
        // max — it's "how far into the next level-up were they, at their
        // best difficulty reached", not the best streak at any difficulty.
        bestStreak: isNewBest ? (streakReached ?? 0) : (prevStat.bestStreak ?? 0),
        bestN: Math.max(prevStat.bestN, levelReached),
        lastAccuracy: scoreValue,
      };
      if (window.storage) {
        safeStorageSet("stats-rrt", JSON.stringify(newStat), false);
      }
      const finalStats = { ...exerciseStatsRef.current, rrt: newStat };
      setExerciseStats(finalStats);
      checkForNewAchievements(finalStats);

      setExerciseHistory((prev) => {
        const prevHistory = prev.rrt || [];
        const newHistory = [
          ...prevHistory,
          { ts: Date.now(), accuracy: scoreValue, n: levelReached, durationMs },
        ].slice(-MAX_HISTORY_ENTRIES);
        if (window.storage) {
          safeStorageSet("history-rrt", JSON.stringify(newHistory), false);
        }
        return { ...prev, rrt: newHistory };
      });
    },
    [checkForNewAchievements]
  );

  // Same idea as recordRrtLevelUp, called by Motion3DExercise whenever the
  // ball speed crosses into a new tier (up OR down — the speed staircase
  // can drop back below a tier after a miss, same as RRT easing back down;
  // only a rise past the previous best actually counts as a PR). `tier` is
  // the integer 1-10 used for the gem/bestN; `rawSpeed` is the actual
  // decimal (e.g. 0.47) used for the displayed score — these used to be
  // conflated (the tier number was also being stored as the displayed
  // score, which would show something like "10.00" instead of "0.50").
  const recordMotion3dLevelUp = useCallback(
    (tier, rawSpeed, title) => {
      const prevStat = exerciseStatsRef.current.motion3d || {
        sessions: 0,
        totalAccuracy: 0,
        bestAccuracy: 0,
        bestN: 0,
      };
      const isNewPR = tier > prevStat.bestN;
      if (isNewPR) {
        const newStat = {
          ...prevStat,
          bestN: tier,
          bestAccuracy: Math.max(prevStat.bestAccuracy, rawSpeed),
        };
        if (window.storage) {
          safeStorageSet("stats-motion3d", JSON.stringify(newStat), false);
        }
        const finalStats = { ...exerciseStatsRef.current, motion3d: newStat };
        setExerciseStats(finalStats);
        checkForNewAchievements(finalStats);
      }
      setUnlockInfo({ exerciseKey: "motion3d", level: tier, title, isNewPR });
    },
    [checkForNewAchievements]
  );

  // Called once a 3D Motion session actually ends (natural 15-min cutoff or
  // the dev-only fast-forward button) — logs it into exerciseHistory.motion3d
  // (what the Overview graph reads) and bumps exerciseStats.motion3d's
  // sessions/totalAccuracy the same way every other exercise's session-end
  // path does. Before this existed, 3D Motion updated exerciseStats.bestN
  // via recordMotion3dLevelUp on a tier crossing but never logged a history
  // entry at all — so it never showed up on the graph, no matter how much
  // was played. `speedReached`/`tierReached` follow the same convention
  // recordQnbPrimeResult already uses for its "decimal" scoreType history
  // entries: the raw score value in `accuracy` (here, the ending speed —
  // NOT a percentage), and its whole-number tier in `n`.
  const recordMotion3dSessionEnd = useCallback(
    ({ speedReached, tierReached, durationMs }) => {
      const prevStat = exerciseStatsRef.current.motion3d || {
        sessions: 0,
        totalAccuracy: 0,
        bestAccuracy: 0,
        bestN: 0,
      };
      const newStat = {
        ...prevStat,
        sessions: prevStat.sessions + 1,
        totalAccuracy: prevStat.totalAccuracy + speedReached,
        bestAccuracy: Math.max(prevStat.bestAccuracy, speedReached),
        bestN: Math.max(prevStat.bestN, tierReached),
        lastAccuracy: speedReached,
      };
      if (window.storage) {
        safeStorageSet("stats-motion3d", JSON.stringify(newStat), false);
      }
      const finalStats = { ...exerciseStatsRef.current, motion3d: newStat };
      setExerciseStats(finalStats);
      checkForNewAchievements(finalStats);

      setExerciseHistory((prev) => {
        const prevHistory = prev.motion3d || [];
        const newHistory = [
          ...prevHistory,
          { ts: Date.now(), accuracy: speedReached, n: tierReached, durationMs },
        ].slice(-MAX_HISTORY_ENTRIES);
        if (window.storage) {
          safeStorageSet("history-motion3d", JSON.stringify(newHistory), false);
        }
        return { ...prev, motion3d: newHistory };
      });
    },
    [checkForNewAchievements]
  );

  // 🧪 Dev-only escape hatch: clears exerciseStats.motion3d (both live state
  // and its persisted storage entry) and re-baselines the achievement
  // tracker against the cleared value. Exists because the 3D Motion tier
  // scale has been recalibrated more than once during development — each
  // time, whatever bestN was already sitting in persisted storage from an
  // earlier scale gets reinterpreted against the new (usually lower) tier
  // thresholds and reads as "already past tier N", making achievements
  // 2 through however-high-it-got look unlocked the moment the app opens,
  // with no real session having crossed them under the current scale. This
  // lets that stale value be cleared by hand instead of living with it.
  const resetMotion3dProgress = useCallback(() => {
    const clearedStat = { sessions: 0, totalAccuracy: 0, bestAccuracy: 0, bestN: 0 };
    if (window.storage) {
      safeStorageSet("stats-motion3d", JSON.stringify(clearedStat), false);
    }
    const finalStats = { ...exerciseStatsRef.current, motion3d: clearedStat };
    setExerciseStats(finalStats);
    // Re-baseline immediately rather than waiting on the passive effect —
    // this only ever removes ids from the unlocked set, so it can't itself
    // spuriously queue a celebration, but it does need to happen before any
    // subsequent real level-up so that one's diff is measured against the
    // cleared baseline, not the stale one.
    checkForNewAchievements(finalStats);
  }, [checkForNewAchievements]);

  // Marks today as a completed-regime day (idempotent — safe to call more
  // than once in the same day). Called when the person reaches the Session
  // Overview screen having gone through every step of their regime.
  const markRegimeCompletedToday = useCallback(() => {
    const today = new Date().toDateString();
    setRegimeCompletionDatesState((prev) => {
      if (prev.includes(today)) return prev;
      const next = [...prev, today].slice(-400); // cap growth of the persisted list
      if (window.storage) {
        safeStorageSet("regime-completion-dates", JSON.stringify(next), false);
      }
      return next;
    });
    // Also log it against the specific regime that was active, so that
    // regime's own automatic train/rest schedule (see REGIME_SCHEDULE) has
    // an accurate history to work from.
    const key = regimeKeyRef.current;
    if (key) {
      setRegimeTrainingDatesState((prev) => {
        const prevForKey = prev[key] || [];
        if (prevForKey.includes(today)) return prev;
        const next = { ...prev, [key]: [...prevForKey, today].slice(-400) };
        if (window.storage) {
          safeStorageSet("regime-training-dates", JSON.stringify(next), false);
        }
        return next;
      });
    }
  }, []);

  const markTutorialSeen = useCallback((regimeKey) => {
    setSeenTutorialRegimesState((prev) => {
      const next = { ...prev, [regimeKey]: true };
      if (window.storage) {
        window.storage
          .set("seen-tutorial-regimes", JSON.stringify(next), false)
          .catch(() => {});
      }
      return next;
    });
  }, []);

  const stopRunTimer = useCallback((exerciseKey) => {
    if (currentRunStartRef.current != null) {
      const elapsed = Date.now() - currentRunStartRef.current;
      currentRunStartRef.current = null;
      setExerciseElapsedMs((prev) => ({
        ...prev,
        [exerciseKey]: (prev[exerciseKey] || 0) + elapsed,
      }));
    }
  }, []);

  const recordSessionResult = useCallback((overallAcc, exerciseKey, levelUsed, statsSnapshot) => {
    const ex = EXERCISE_LIBRARY[exerciseKey];
    // statsSnapshot is the exerciseStats object exactly as it stood right
    // after this session's own stat bump was applied (passed in by the
    // caller, runTrial). Using it directly — instead of
    // exerciseStatsRef.current, which only catches up via its own separate
    // effect that runs after commit — means the level-up bump below and the
    // achievement check that follows it both work off the same
    // known-correct numbers in the same synchronous pass, with no
    // dependency on effect timing.
    const baseStats = statsSnapshot || exerciseStatsRef.current;
    if (overallAcc < PASS_THRESHOLD) {
      setLowScoreStreak((prev) => {
        const nextCount = (prev[exerciseKey] || 0) + 1;
        if (nextCount >= 3) {
          const nextN = Math.max(1, levelUsed - 1);
          setN(nextN);
          setExerciseLevel(exerciseKey, nextN);
          setLevelChangeNotice({ direction: "down" });
          return { ...prev, [exerciseKey]: 0 };
        }
        return { ...prev, [exerciseKey]: nextCount };
      });
    } else {
      setLowScoreStreak((prev) => ({ ...prev, [exerciseKey]: 0 }));
      const nextN = Math.min(ex.maxN, levelUsed + 1);
      setN(nextN);
      setExerciseLevel(exerciseKey, nextN);
      const prevBestN = baseStats[exerciseKey]?.bestN || 0;
      const isNewPR = levelUsed > prevBestN;
      const title = ex.title.replace("N-Back", `${nextN}-Back`);
      if (isNewPR) {
        // Small banner on the Results screen — stays PR-only, separate from
        // the full-screen level-up celebration below.
        setNewPRBanners((prev) => ({
          ...prev,
          [exerciseKey]: title,
        }));
      }
      // Fires every time they actually level up — climbing back to a level
      // they've hit before (e.g. D4B → D3B → D4B) still celebrates, not just
      // new personal bests. Only skipped when nextN === levelUsed, i.e.
      // they passed while already sitting at the exercise's max level, so
      // there's no real "up" to celebrate. Deliberately does NOT touch
      // mainView (see the `unlockInfo &&` block further down), so it doesn't
      // interrupt the session or bounce the person out of their regime the
      // way a screen change would.
      if (nextN > levelUsed) {
        const prevStat = baseStats[exerciseKey] || {
          sessions: 0,
          totalAccuracy: 0,
          bestAccuracy: 0,
          bestN: 0,
        };
        if (prevStat.bestN < nextN) {
          // Bump bestN to the level they've just been promoted TO (not just
          // the level they finished playing at), and check for newly-
          // unlocked achievements against that exact bumped snapshot —
          // both right here, synchronously, in the same call that fires the
          // level-up celebration. This is what actually guarantees the
          // achievement is already queued and ready to chain in the instant
          // "Accept" is clicked, rather than depending on some other effect
          // to notice the change afterward.
          const newStat = { ...prevStat, bestN: nextN };
          if (window.storage) {
            window.storage
              .set(`stats-${exerciseKey}`, JSON.stringify(newStat), false)
              .catch(() => {});
          }
          const finalStats = { ...baseStats, [exerciseKey]: newStat };
          setExerciseStats(finalStats);
          checkForNewAchievements(finalStats);
        }
        setUnlockInfo({ exerciseKey, level: nextN, title, isNewPR });
      }
    }
  }, [setExerciseLevel, checkForNewAchievements]);

  const runTrial = useCallback((seq, i, resultsSoFar, modalities, generation, exerciseKey, levelUsed) => {
    if (generation !== runGenerationRef.current) return; // aborted (e.g. session switch)

    const length = seq[modalities[0]].length;
    if (i >= length) {
      const sessionDurationMs =
        currentRunStartRef.current != null
          ? Date.now() - currentRunStartRef.current
          : 0;
      stopRunTimer(exerciseKey);
      setResults(resultsSoFar);
      setScreen("results");

      const overallAcc = overallSignalAccuracy(resultsSoFar, modalities);

      if (exerciseKey === "iqnb") {
        // QNB' tracks its own float level (e.g. 4.37) instead of the plain
        // integer every other exercise uses, so its exerciseStats entry
        // stores that level (not the raw session %) as `bestAccuracy` —
        // matching the "decimal" scoreType convention formatScoreValue
        // expects (see EXERCISE_LIBRARY.iqnb / LEADERBOARD_DATA.iqnb).
        // The bestN/exerciseStats bump and achievement check both live
        // inside recordQnbPrimeResult itself now (shared with the setup
        // screen's simulate-run buttons) — this just logs the history entry.
        const delta = recordQnbPrimeResult(overallAcc);
        setQnbPrimeLastDelta(delta);
        const newLevel = qnbPrimeLevelRef.current;
        setExerciseHistory((prev) => {
          const prevHistory = prev.iqnb || [];
          const newHistory = [
            ...prevHistory,
            { ts: Date.now(), accuracy: newLevel, n: Math.floor(newLevel), durationMs: sessionDurationMs },
          ].slice(-MAX_HISTORY_ENTRIES);
          if (window.storage) {
            safeStorageSet("history-iqnb", JSON.stringify(newHistory), false);
          }
          return { ...prev, iqnb: newHistory };
        });
        return;
      }

      // Built off exerciseStatsRef.current (the trusted last-committed
      // snapshot) rather than a setState updater, so we have the exact
      // resulting object in hand right here to pass straight into
      // recordSessionResult — instead of it having to guess at the current
      // stats via a ref that hasn't necessarily caught up yet.
      const prevStat = exerciseStatsRef.current[exerciseKey] || {
        sessions: 0,
        totalAccuracy: 0,
        bestAccuracy: 0,
        bestN: 0,
      };
      const sessionStat = {
        sessions: prevStat.sessions + 1,
        totalAccuracy: prevStat.totalAccuracy + overallAcc,
        bestAccuracy: Math.max(prevStat.bestAccuracy, overallAcc),
        bestN: Math.max(prevStat.bestN, levelUsed),
        lastAccuracy: overallAcc,
      };
      if (window.storage) {
        window.storage
          .set(`stats-${exerciseKey}`, JSON.stringify(sessionStat), false)
          .catch(() => {});
      }
      const statsAfterSession = { ...exerciseStatsRef.current, [exerciseKey]: sessionStat };
      setExerciseStats(statsAfterSession);

      setExerciseHistory((prev) => {
        const prevHistory = prev[exerciseKey] || [];
        const newHistory = [
          ...prevHistory,
          { ts: Date.now(), accuracy: overallAcc, n: levelUsed, durationMs: sessionDurationMs },
        ].slice(-MAX_HISTORY_ENTRIES);
        if (window.storage) {
          window.storage
            .set(`history-${exerciseKey}`, JSON.stringify(newHistory), false)
            .catch(() => {});
        }
        return { ...prev, [exerciseKey]: newHistory };
      });

      recordSessionResult(overallAcc, exerciseKey, levelUsed, statsAfterSession);
      return;
    }

    setIndex(i);

    // Show the cue immediately and fire the spoken letter alongside it.
    // This used to delay the visual cue until speech synthesis actually
    // started (via onstart, with a 220ms fallback) to try to keep them in
    // sync — but TTS startup latency is unpredictable, so that just made
    // the square noticeably late instead. The square should never wait on it.
    setActiveCell(seq.pos[i]);
    if (modalities.includes("audio")) {
      speak(seq.audio[i]);
    }

    respondedRef.current = emptyModalityState(modalities, false);
    setFeedback(emptyModalityState(modalities, null));

    const nForTrial = seq.__n;
    const matches = {};
    modalities.forEach((m) => {
      matches[m] = i >= nForTrial && seq[m][i] === seq[m][i - nForTrial];
    });
    currentMatchRef.current = matches;

    window.__nbackRespond = (type) => {
      respondedRef.current[type] = true;
    };

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (generation !== runGenerationRef.current) return;
      const record = {};
      const missedModalities = [];
      modalities.forEach((m) => {
        const responded = respondedRef.current[m];
        record[m] = {
          match: matches[m],
          responded,
          correct: responded ? matches[m] : !matches[m],
        };
        if (matches[m] && !responded) missedModalities.push(m);
      });
      if (missedModalities.length > 0) {
        setFeedback((prev) => {
          const next = { ...prev };
          missedModalities.forEach((m) => (next[m] = "wrong"));
          return next;
        });
      }
      setActiveCell(null);
      setTimeout(() => {
        if (generation !== runGenerationRef.current) return;
        runTrial(seq, i + 1, [...resultsSoFar, record], modalities, generation, exerciseKey, levelUsed);
      }, ISI_MS);
    }, exerciseKey === "iqnb" && qnbPrimeRunSettingsRef.current
      ? qnbPrimeRunSettingsRef.current.stimulusMs
      : EXERCISE_LIBRARY[exerciseKey].stimMs);
  }, []);

  const startTask = useCallback(
    (exerciseForStart, nForStart) => {
      const ex = exerciseForStart || exercise;
      const isQnbPrime = ex.key === "iqnb";
      const qnbStep = isQnbPrime ? qnbPrimeLevelParts(qnbPrimeLevelRef.current).step : null;
      const qnbSettings = isQnbPrime ? qnbPrimeSettingsFor(qnbStep) : null;
      if (isQnbPrime) qnbPrimeRunSettingsRef.current = qnbSettings;
      const nn = isQnbPrime ? Math.floor(qnbPrimeLevelRef.current) : nForStart ?? n;
      const tt = trialsForLevel(nn);
      const runInterference = isQnbPrime ? qnbSettings.interferencePct / 100 : interference;

      if (!sessionStartedRef.current[ex.key] && ex.sessionDurationMs) {
        sessionStartedRef.current[ex.key] = true;
        sessionTimerStartRef.current[ex.key] = Date.now();
        const fromIndex = activeExercisesRef.current.findIndex((e) => e.key === ex.key);
        sessionTimersRef.current[ex.key] = setTimeout(
          () => forceSwitchToNext(fromIndex),
          ex.sessionDurationMs
        );
      }
      const modalities = ex.modalities;
      // Dual runs at 30%, Quad at 25%. QNB' ignores both of those — it has
      // its own per-step progression (25% at X.00 down to 13% at X.99,
      // see qnbPrimeSettingsFor) so the challenge ramps as the score climbs.
      const runMatchChance = isQnbPrime
        ? qnbSettings.matchChancePct / 100
        : ex.key === "quad"
        ? 0.25
        : 0.3;
      const seq = generateSequence(modalities, nn, tt, runInterference, runMatchChance);
      setSequence(seq);
      setResults([]);
      setIndex(0);
      setLevelChangeNotice(null);
      // Keep the shared `n` state (used generically for the running-screen
      // trial countdown, title, etc.) in sync with the level QNB' actually
      // just started at, since it derives nn from qnbPrimeLevel instead of
      // the passed-in n/nForStart.
      if (isQnbPrime) setN(nn);
      setNewPRBanners((prev) => {
        if (!(ex.key in prev)) return prev;
        const next = { ...prev };
        delete next[ex.key];
        return next;
      });
      setScreen("running");
      currentRunStartRef.current = Date.now();
      runGenerationRef.current += 1;
      runTrial(seq, 0, [], modalities, runGenerationRef.current, ex.key, nn);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, exercise, runTrial, interference]
  );

  const forceSwitchToNext = useCallback((fromIndex) => {
    if (exerciseIndexRef.current !== fromIndex) return; // already moved on
    const list = activeExercisesRef.current;
    const currentEx = list[fromIndex];
    clearTimeout(sessionTimersRef.current[currentEx.key]);
    runGenerationRef.current += 1; // abort any in-flight trial loop
    clearTimeout(timeoutRef.current);
    stopRunTimer(currentEx.key);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    const nextIndex = fromIndex + 1;
    if (nextIndex >= list.length) return; // nothing further defined

    setSwitchNotice(true);
    setExerciseIndex(nextIndex);
    setScreen("setup");

    const nextExercise = list[nextIndex];
    if (nextExercise.key === "overview") {
      // Landing on the Session Overview screen straight out of a training session —
      // show today's training time, not the lifetime total.
      setOverviewSource("training");
      // They've gone through every step of today's regime — count it toward
      // the 7-day regime-streak achievement.
      markRegimeCompletedToday();
    }
    setTimeout(() => {
      setSwitchNotice(false);
      setN(exerciseLevelsRef.current[nextExercise.key] ?? nextExercise.defaultN);
      // land on the setup screen for the next exercise; user presses Start themselves
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(sessionTimersRef.current).forEach(clearTimeout);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const handlePress = (type) => {
    if (respondedRef.current[type]) return;
    if (window.__nbackRespond) window.__nbackRespond(type);

    const correct = currentMatchRef.current[type];
    setFeedback((prev) => ({ ...prev, [type]: correct ? "correct" : "wrong" }));
    // Feedback intentionally persists until the next trial resets it (no auto-clear timer) —
    // this keeps a wrong/red flash visible long enough to actually register.
  };

  const handlePressRef = useRef(handlePress);
  handlePressRef.current = handlePress;

  useEffect(() => {
    if (screen !== "running") return;
    const onKeyDown = (e) => {
      const type = KEY_BINDINGS[e.key.toLowerCase()];
      if (type && exercise.modalities.includes(type)) {
        e.preventDefault();
        handlePressRef.current(type);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, exercise]);

  // Space starts the next round directly from the results screen —
  // no click, no trip back through the setup screen.
  useEffect(() => {
    if (mainView !== "app" || switchNotice || screen !== "results") return;
    const onKeyDown = (e) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        startTask(exercise, n);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mainView, switchNotice, screen, exercise, n, startTask]);

  const [, setHomeTick] = useState(0);
  useEffect(() => {
    if (mainView !== "home") return;
    const id = setInterval(() => setHomeTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [mainView]);

  // ---- stats ----
  const accuracyFor = (modality) =>
    Math.round(modalitySignalAccuracy(results, modality) * 100);
  const overallAccuracy = overallSignalAccuracy(results, exercise.modalities);

  // One single leaderboard covering every exercise, independent of whichever
  // regime is active — the person picks which exercise's leaderboard to view
  // from a dropdown instead of it being scoped/filtered by their regime.
  const currentRegime = REGIMES.find((r) => r.key === regimeKey) || REGIMES[0];
  const leaderboardTabs = Object.values(EXERCISE_LIBRARY).map((e) => ({
    key: e.key,
    label: e.title,
    abbrev: e.abbrev,
  }));
  const activeLeaderboardTab = leaderboardTabs.some((t) => t.key === leaderboardTab)
    ? leaderboardTab
    : leaderboardTabs[0]?.key;

  // Overview lists only the exercises used by the active regime, in the
  // order they appear in that regime's step list (e.g. Dual N-Back is
  // exercise 1 of 4 in one regime but 3rd in another — the overview should
  // match whichever position it actually runs in).
  const overviewExercises = Array.from(
    new Set(currentRegime.steps.map((s) => s.key))
  ).map((key) => EXERCISE_LIBRARY[key]);

  // Tutorial mirrors the regime's own step order (same list as the overview) —
  // it starts on that regime's first exercise and "Next" walks through the rest.
  const tutorialExercises = overviewExercises;
  const tutorialStepExercise = tutorialExercises[tutorialStep] || tutorialExercises[0];
  const isLastTutorialStep = tutorialStep >= tutorialExercises.length - 1;

  // Whether they've finished their WHOLE regime today (not just attempted
  // one exercise) — this is what "Tomorrow" on the Next-session card means,
  // and what disables the Start button below.
  const trainedToday = regimeCompletionDates.includes(new Date().toDateString());

  // Feeds the Achievements screen.
  const achievementState = {
    streak: currentStreakDays(exerciseHistory, streakBrokenAt),
    regimeStreak: currentRegimeStreakDays(regimeCompletionDates),
    exerciseStats,
    totalSessions: Object.values(exerciseStats).reduce(
      (sum, v) => sum + (v?.sessions || 0),
      0
    ),
    totalMsTrained: msTrainedTotal(exerciseHistory),
    comeback: hasComebackFromBrokenStreak(exerciseHistory),
    simulatedUnlockedIds,
  };
  // The frame you've actually equipped (Club Penguin-style — pick one even if
  // several are unlocked), falling back to "none" if it's somehow no longer
  // unlocked (e.g. a simulated badge that got un-simulated).
  const selectedFrameOption = FRAME_OPTIONS.find((f) => f.id === selectedFrameId);
  const ownAvatarFrameTier =
    selectedFrameOption && isCosmeticUnlocked(selectedFrameOption, achievementState)
      ? selectedFrameId
      : "none";
  const ownProfileColorId = isCosmeticUnlocked(
    PROFILE_COLOR_OPTIONS.find((c) => c.id === selectedColorId) || PROFILE_COLOR_OPTIONS[0],
    achievementState
  )
    ? selectedColorId
    : "indigo";
  const ownProfileBackground =
    PROFILE_BACKGROUND_OPTIONS.find(
      (b) => b.id === selectedBackgroundId && isCosmeticUnlocked(b, achievementState)
    ) || PROFILE_BACKGROUND_OPTIONS[0];
  const ownFeaturedBadge = featuredBadgeId
    ? ACHIEVEMENTS_CATALOG.find(
        (a) => a.id === featuredBadgeId && isAchievementUnlocked(a, achievementState)
      )
    : null;

  // Feeds the Profile screen — whichever leaderboard entry (or "you") was
  // last clicked into.
  const isOwnProfile = profileTarget === "you";
  const profileDisplayName = isOwnProfile ? displayName : profileTarget;
  const profileAvatarId = isOwnProfile ? selectedAvatarId : PLACEHOLDER_AVATARS[profileTarget];
  const profileImageUrl = isOwnProfile ? customAvatarImage : undefined;
  const profileState = isOwnProfile
    ? achievementState
    : mockAchievementStateFor(profileTarget || "");
  const profileFrameTier = isOwnProfile ? ownAvatarFrameTier : avatarFrameTier(profileState);
  const profileColorId = isOwnProfile ? ownProfileColorId : "indigo";
  const profileBackground = isOwnProfile ? ownProfileBackground : PROFILE_BACKGROUND_OPTIONS[0];
  const profileFeaturedBadge = isOwnProfile ? ownFeaturedBadge : null;

  // Whether a full session (across all timed exercises) is still underway —
  // i.e. at least one exercise's timer has started and we haven't reached the
  // Session Overview screen yet.
  const sessionInProgress =
    Object.keys(sessionStartedRef.current).length > 0 &&
    exercise.key !== "overview";

  function totalSessionTimeRemainingMs() {
    const now = Date.now();
    let remaining = 0;
    activeExercises.forEach((e, idx) => {
      if (!e.sessionDurationMs) return;
      if (idx < exerciseIndex) return; // already completed
      if (idx === exerciseIndex) {
        const startTs = sessionTimerStartRef.current[e.key];
        remaining +=
          startTs != null
            ? Math.max(0, e.sessionDurationMs - (now - startTs))
            : e.sessionDurationMs;
      } else {
        remaining += e.sessionDurationMs; // not reached yet
      }
    });
    return remaining;
  }

  const goToOverview = () => {
    const overviewIndex = activeExercises.findIndex((e) => e.key === "overview");
    setExerciseIndex(overviewIndex);
    setOverviewView("summary");
    setOverviewSource("home");
    setMainView("app");
  };

  // Dev/test only — clears everything that makes the Next-session card say
  // "Tomorrow" / "Session in progress" / "Resume Training", so Start
  // Training can be exercised repeatedly without waiting for a real new day
  // or finishing a real session first.
  const resetNextSessionForTesting = () => {
    Object.values(sessionTimersRef.current).forEach(clearTimeout);
    sessionTimersRef.current = {};
    sessionStartedRef.current = {};
    sessionTimerStartRef.current = {};
    const today = new Date().toDateString();
    setRegimeCompletionDatesState((prev) => {
      const next = prev.filter((d) => d !== today);
      if (window.storage) {
        safeStorageSet("regime-completion-dates", JSON.stringify(next), false);
      }
      return next;
    });
    const key = regimeKeyRef.current;
    if (key) {
      setRegimeTrainingDatesState((prev) => {
        const next = { ...prev, [key]: (prev[key] || []).filter((d) => d !== today) };
        if (window.storage) {
          safeStorageSet("regime-training-dates", JSON.stringify(next), false);
        }
        return next;
      });
    }
    setExerciseIndex(0);
    setScreen("setup");
  };

  const proceedStartFromHome = () => {
    // If we're currently parked on the overview "exercise" (e.g. from a
    // previous visit), land on the first exercise in the regime instead of it
    // — restoring whatever level they'd actually reached there, not always
    // resetting back to that exercise's starting default.
    if (exercise.key === "overview") {
      setExerciseIndex(0);
      const first = activeExercises[0];
      setN(exerciseLevelsRef.current[first.key] ?? first.defaultN);
    }
    setScreen("setup");
    setMainView("app");
  };

  const startFromHome = () => {
    // Resume an in-progress session right where it was left off.
    if (sessionInProgress) {
      setMainView("app");
      return;
    }
    // Quick/Balanced/Deep each carry their own automatic train/rest
    // schedule — if today's a scheduled rest day for whichever regime is
    // active AND there's an actual streak at stake, confirm before letting
    // them train through it. With no streak (0 days) there's nothing to
    // reset, so skip the warning entirely.
    if (regimeKey && isRegimeRestDay(regimeKey, regimeTrainingDates[regimeKey] || [], new Date())) {
      const activeStreak = currentScheduledRegimeStreak(
        regimeKey,
        regimeTrainingDates[regimeKey] || [],
        regimeStreakBrokenAt[regimeKey]
      );
      if (activeStreak > 0) {
        setRestDayConfirm({
          regimeKey,
          streak: activeStreak,
          action: proceedStartFromHome,
          reason: "train",
        });
        return;
      }
    }
    proceedStartFromHome();
  };

  const startRegime = (key) => {
    const regime = REGIMES.find((r) => r.key === key);
    const built = buildRegimeExercises(regime);
    // Starting a fresh regime — clear any timers/flags from a previous session.
    Object.values(sessionTimersRef.current).forEach(clearTimeout);
    sessionTimersRef.current = {};
    sessionStartedRef.current = {};
    sessionTimerStartRef.current = {};
    setRegimeKey(key);
    setActiveExercises(built);
    setExerciseIndex(0);
    setN(built[0].defaultN);
    setScreen("setup");
    setSwitchNotice(false);
    setLevelChangeNotice(null);
    if (!seenTutorialRegimes[key]) {
      markTutorialSeen(key);
      setTutorialStep(0);
      setMainView("tutorial");
    } else {
      setMainView("home");
    }
  };

  // Dev/test-only: zeroes the streak back to 0. Severs it at today (same
  // mechanism as a confirmed regime-switch) so it reads 0 immediately even
  // if a real session was already logged today, and clears out any
  // leftover synthetic _streakTest entries so they don't linger and
  // resurface as "already at N" on a later reload.
  const resetTestStreak = () => {
    const today = new Date().toDateString();
    setStreakBrokenAtState(today);
    if (window.storage) {
      safeStorageSet("streak-broken-at", JSON.stringify(today), false);
    }
    setExerciseHistory((prev) => {
      if (!prev._streakTest) return prev;
      const { _streakTest, ...rest } = prev;
      if (window.storage) {
        safeStorageSet("history-_streakTest", JSON.stringify([]), false);
      }
      return rest;
    });
  };

  // Dev/test-only: bumps the general daily streak (the one the 🔥 badge
  // and the regime-switch warning both key off) by exactly one day, without
  // running an exercise. Adds a synthetic entry for the day immediately
  // before the current streak's start under a dedicated pseudo-exercise key
  // so it never touches real per-exercise stats/leaderboards. Also clears
  // any same-day streakBrokenAt so a just-tested reset doesn't swallow it.
  const bumpTestStreak = (key) => {
    const today = new Date().toDateString();
    if (streakBrokenAt === today) {
      setStreakBrokenAtState(null);
      if (window.storage) {
        safeStorageSet("streak-broken-at", JSON.stringify(null), false);
      }
    }
    const liveStreak = currentStreakDays(
      exerciseHistory,
      streakBrokenAt === today ? null : streakBrokenAt
    );
    const backDate = new Date();
    backDate.setDate(backDate.getDate() - liveStreak);
    backDate.setHours(12, 0, 0, 0);
    const ts = backDate.getTime();
    setExerciseHistory((prev) => {
      const prevHistory = prev._streakTest || [];
      const newHistory = [
        ...prevHistory,
        { ts, accuracy: 0, n: 0, durationMs: 0 },
      ].slice(-MAX_HISTORY_ENTRIES);
      if (window.storage) {
        window.storage
          .set("history-_streakTest", JSON.stringify(newHistory), false)
          .catch(() => {});
      }
      return { ...prev, _streakTest: newHistory };
    });
    if (regimeKey !== key) {
      setRegimeKey(key);
    }
  };

  const chooseRegime = (key) => {
    // Switching to a different regime abandons whatever daily streak is
    // currently live — warn whenever the person has one (> 0 days), using
    // the same streak the 🔥 badge on Home shows, so what's warned about
    // matches what's visibly at stake.
    const activeKey = regimeKey;
    const switchingAway = activeKey !== null && key !== activeKey;
    const liveStreak = currentStreakDays(exerciseHistory, streakBrokenAt);
    if (switchingAway && liveStreak > 0) {
      setRestDayConfirm({
        regimeKey: activeKey,
        streak: liveStreak,
        action: () => startRegime(key),
        reason: "switch",
      });
      return;
    }
    startRegime(key);
  };

  const confirmRestDayTraining = () => {
    if (!restDayConfirm) return;
    const { regimeKey: key, reason, action } = restDayConfirm;
    const today = new Date().toDateString();
    if (reason === "switch") {
      setStreakBrokenAtState(today);
      if (window.storage) {
        safeStorageSet("streak-broken-at", JSON.stringify(today), false);
      }
    } else {
      setRegimeStreakBrokenAtState((prev) => {
        const next = { ...prev, [key]: today };
        if (window.storage) {
          safeStorageSet("regime-streak-broken-at", JSON.stringify(next), false);
        }
        return next;
      });
    }
    setRestDayConfirm(null);
    action();
  };

  const cancelRestDayTraining = () => setRestDayConfirm(null);

  const isMotion3dApp = mainView === "app" && exercise.key === "motion3d";

  return (
    <div
      className={`relative min-h-screen w-full bg-slate-950 text-slate-100 flex overflow-y-auto overflow-x-hidden ${
        isMotion3dApp ? "items-stretch justify-center p-2" : "items-center justify-center p-12"
      }`}
    >
      <div
        className="pointer-events-none absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-indigo-600/20 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-violet-600/15 blur-[120px]"
        aria-hidden="true"
      />
      <style>{`
        @keyframes auraPulseGlow {
          0%, 100% { box-shadow: 0 0 6px 1px rgba(236,72,153,0.35); }
          50% { box-shadow: 0 0 18px 5px rgba(236,72,153,0.6); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(700px) rotate(360deg); opacity: 0; }
        }
        @keyframes celebrationPop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rankGlowPulse {
          0%, 100% { box-shadow: 0 0 10px 1px rgba(250,204,21,0.35), 0 0 0 1px rgba(250,204,21,0.4) inset; }
          50% { box-shadow: 0 0 24px 6px rgba(250,204,21,0.6), 0 0 0 1px rgba(250,204,21,0.7) inset; }
        }
        /* Belt-and-suspenders hover/press feedback: written as plain CSS
           (not a Tailwind utility class) so it renders regardless of which
           hover: variants the current preview environment did or didn't
           precompile. Layers on top of whatever each button's own
           hover:/active: Tailwind classes already do — never fights them,
           just guarantees SOME visible feedback everywhere.
           Uses box-shadow (an inset overlay), not filter or transform —
           filter can force the button onto its own compositing layer, and
           on small/tightly-packed buttons the subpixel rounding from that
           reads as a visible "jump" on hover. box-shadow doesn't affect
           layout or trigger that recompositing, so it can't cause it. */
        button:not(:disabled) {
          transition: box-shadow 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
        }
        button:not(:disabled):hover {
          box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.08);
        }
        button:not(:disabled):active {
          box-shadow: inset 0 0 0 999px rgba(0, 0, 0, 0.15);
        }
        @keyframes gemPop {
          0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gemGlowPulse {
          0%, 100% { filter: drop-shadow(0 4px 7px rgba(0,0,0,0.55)) drop-shadow(0 0 8px var(--glow-color)); }
          50% { filter: drop-shadow(0 4px 7px rgba(0,0,0,0.55)) drop-shadow(0 0 22px var(--glow-color)); }
        }
        @keyframes sparkleFloat {
          0% { transform: translateY(4px) scale(0.7); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translateY(-36px) scale(1.1); opacity: 0; }
        }
      `}</style>
      <div
        className="relative w-full"
        style={
          isMotion3dApp
            ? { maxWidth: "100vw" }
            : { maxWidth: "42rem" }
        }
      >
        {mainView === "regime" && (
          <div className="space-y-14">
            <div>
              <h1 className="text-5xl font-semibold tracking-tight">
                Choose your regime
              </h1>
              <p className="text-slate-400 text-base mt-3">
                You'll ease into it gradually, starting with a few minutes each session.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {REGIMES.map((r) => {
                const acc = ACCENT_STYLES[r.accent];
                return (
                  <button
                    key={r.key}
                    onClick={() => chooseRegime(r.key)}
                    className={`w-full text-left ${acc.bg} border-2 ${acc.border} ${acc.hoverBorderStrong} transition-colors rounded-xl p-8`}
                  >
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${acc.dot}`} />
                        <div className="text-2xl font-semibold text-slate-100">
                          {r.title}
                        </div>
                        {r.key === "medium" && (
                          <span className={`italic text-sm font-medium ${acc.text}`}>
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className={`text-lg font-medium ${acc.text}`}>
                        {r.subtitle}
                      </div>
                    </div>
                    <div className="text-slate-400 text-base mt-2">
                      {r.summary}
                    </div>
                  </button>
                );
              })}

              {/* Locked regime — unlocks with the "1-Month Streak" achievement.
                  Purely a teaser for now: disabled, no click handler, just a
                  hover tooltip explaining what unlocks it. */}
              <div className="relative group">
                <button
                  disabled
                  className="w-full text-left bg-slate-900/60 border-2 border-slate-800 rounded-xl p-8 cursor-not-allowed"
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                      <div className="text-2xl font-semibold text-slate-500 flex items-center gap-2">
                        🔒 Custom
                      </div>
                    </div>
                    <div className="text-lg font-medium text-slate-600">—</div>
                  </div>
                  <div className="text-slate-600 text-base mt-2">
                    Build your own regime from scratch.
                  </div>
                </button>
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium rounded-lg px-4 py-2 shadow-lg whitespace-nowrap z-10">
                  Achievement required: 1 month streak
                </div>
              </div>
            </div>

            {regimeKey && (
              <button
                onClick={() => setMainView("account")}
                className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                Back
              </button>
            )}
          </div>
        )}

        {mainView === "achievements" && (
          <div className="space-y-14">
            <div>
              <button
                onClick={() => setMainView("home")}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-3"
              >
                ‹ Back
              </button>
              <h1 className="text-4xl font-semibold tracking-tight">Achievements</h1>
              <p className="text-slate-400 text-base mt-3">
                {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, achievementState)).length} of{" "}
                {ACHIEVEMENTS_CATALOG.length} unlocked
              </p>
            </div>

            {["Consistency", "Performance", "Variety", "Volume"].map((group) => {
              const groupAccent = ACCENT_STYLES[GROUP_ACCENTS[group]];
              return (
                <div key={group} className="space-y-5">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-100 flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${groupAccent.dot}`} />
                    {group}
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {ACHIEVEMENTS_CATALOG.filter((a) => a.group === group).map((a) => {
                      const isUnlocked = isAchievementUnlocked(a, achievementState);
                      const progressText =
                        !isUnlocked && a.progress ? a.progress(achievementState) : null;
                      const progressMatch =
                        progressText && progressText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
                      const progressFrac = progressMatch
                        ? Math.min(1, Number(progressMatch[1]) / Number(progressMatch[2]))
                        : null;
                      return (
                        <div
                          key={a.id}
                          className={`rounded-lg p-5 border transition-colors ${
                            isUnlocked
                              ? `${groupAccent.bg} ${groupAccent.border}`
                              : "bg-slate-900 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-5">
                            <div
                              className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-2xl ${
                                isUnlocked
                                  ? `bg-gradient-to-br ${groupAccent.grad} shadow-lg shadow-black/30`
                                  : "bg-slate-800 grayscale opacity-50"
                              }`}
                            >
                              {a.icon}
                            </div>
                            <div className="flex-1">
                              <div
                                className={`text-lg font-semibold ${
                                  isUnlocked ? "text-slate-100" : "text-slate-400"
                                }`}
                              >
                                {a.title}
                              </div>
                              <div className="text-sm text-slate-500 mt-0.5">
                                {a.description}
                              </div>
                              {a.reward && (
                                <div className={`italic text-sm mt-1 ${groupAccent.text}`}>
                                  Unlocks: {a.reward}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              {isUnlocked ? (
                                <span className={`text-sm font-semibold ${groupAccent.text}`}>
                                  ✓ Achieved
                                </span>
                              ) : (
                                <span className="text-sm text-slate-500">
                                  {progressText || "Locked"}
                                </span>
                              )}
                            </div>
                          </div>
                          {progressFrac !== null && (
                            <div className="mt-4 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${groupAccent.grad}`}
                                style={{ width: `${progressFrac * 100}%` }}
                              />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setSimulatedUnlockedIds((ids) => new Set(ids).add(a.id));
                              setAchievementCelebrationQueue((q) => [...q, a]);
                            }}
                            className="mt-4 w-full border border-dashed border-slate-700 text-slate-500 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 text-xs"
                          >
                            🧪 {isUnlocked ? "Replay celebration" : "Simulate unlock"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {mainView === "home" && (
          <div className="space-y-14">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-5">
                <AvatarFrame tier={ownAvatarFrameTier}>
                  <Avatar avatarId={selectedAvatarId} imageUrl={customAvatarImage} size={44} />
                </AvatarFrame>
                <div>
                  <div className="text-slate-400 text-base">Welcome back</div>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {displayName}
                  </h1>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => setStreakCardOpen(true)}
                  className={`flex items-center gap-2 rounded-lg py-2 px-5 text-base font-semibold ${
                    achievementState.streak > 0
                      ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/40 text-orange-100"
                      : "bg-slate-800 border border-slate-700 text-slate-500"
                  }`}
                >
                  <span className="text-lg">🔥</span>
                  <span>{achievementState.streak} Days</span>
                </button>
                <button
                  onClick={() => bumpTestStreak(regimeKey)}
                  title="Test: +1 day streak"
                  className="flex items-center justify-center rounded-lg py-2 px-3 text-sm border border-dashed border-slate-600/70 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
                >
                  🧪 +1
                </button>
                <button
                  onClick={resetTestStreak}
                  title="Test: reset streak to 0"
                  className="flex items-center justify-center rounded-lg py-2 px-3 text-sm border border-dashed border-slate-600/70 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
                >
                  🧪 ↺
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {overviewExercises.map((e) => {
                const level = exerciseLevels[e.key] ?? e.defaultN;
                const isAccuracy = e.scoreType === "accuracy";
                const stat = exerciseStats[e.key];
                // Show the personal-best level here (matching the gem shown
                // on the Leaderboard/Profile) rather than the current
                // adaptive practice level, which is often low right after a
                // level-down and would otherwise show a dull grey gem.
                // Also floor it at whatever the mock "You" leaderboard row
                // shows for this exercise, so the two stay visually in sync
                // instead of Home falling back to a real (currently empty)
                // level while Leaderboard shows the placeholder demo level.
                const mockYouLevel = LEADERBOARD_DATA[e.key]?.find(
                  (row) => row.name === "You"
                )?.level;
                const bestLevel = Math.max(
                  stat?.bestN || level,
                  mockYouLevel || level
                );
                const acc = ACCENT_STYLES[e.accent];
                return (
                  <div
                    key={e.key}
                    className={`${acc.bg} border ${acc.border} rounded-xl p-7`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${acc.dot}`} />
                      <div className="text-xl font-semibold text-slate-100">
                        {e.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 mt-3">
                      <LevelGem level={bestLevel} size={36} />
                      <div className={`text-lg font-medium ${acc.text}`}>
                        {isAccuracy
                          ? `${e.abbrev}${bestLevel}B`
                          : formatScoreValue(e, stat ? stat.bestAccuracy : level)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900 border border-slate-700/70 rounded-xl p-7">
              <div className="text-xl font-semibold text-slate-100">
                {sessionInProgress ? "Session in progress" : "Next session"}
              </div>
              {sessionInProgress ? (
                <div className="text-lg mt-2 text-amber-400">
                  {formatDuration(totalSessionTimeRemainingMs())} left
                </div>
              ) : (
                <div
                  className={`text-lg mt-2 ${
                    trainedToday ? "text-slate-500" : "text-emerald-400"
                  }`}
                >
                  {trainedToday ? "Tomorrow" : "Today"}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5 pt-4">
              <button
                onClick={startFromHome}
                disabled={trainedToday && !sessionInProgress}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
              >
                {sessionInProgress
                  ? "Resume Training"
                  : trainedToday
                  ? "Done for Today"
                  : "Start Training"}
              </button>
              <button
                onClick={goToOverview}
                className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                Overview
              </button>
              <button
                onClick={resetNextSessionForTesting}
                className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors rounded-lg py-3 text-sm"
              >
                🧪 Reset next session (test)
              </button>
            </div>
          </div>
        )}

        {mainView === "leaderboard" && (
          <div className="space-y-12">
            <div>
              <button
                onClick={() => setMainView("home")}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-3"
              >
                ‹ Back
              </button>
              <h1 className="text-4xl font-semibold tracking-tight">
                Leaderboard
              </h1>
            </div>

            <Dropdown
              label="Select leaderboard"
              options={leaderboardTabs.map((tab) => ({ value: tab.key, label: tab.label }))}
              value={activeLeaderboardTab}
              onChange={setLeaderboardTab}
              accent={ACCENT_STYLES[EXERCISE_LIBRARY[activeLeaderboardTab]?.accent]}
            />

            <div className="space-y-4">
              {(LEADERBOARD_DATA[activeLeaderboardTab] || []).map((entry, i) => {
                const rank = i + 1;
                const tabExercise = EXERCISE_LIBRARY[activeLeaderboardTab];
                const tabAccent = ACCENT_STYLES[tabExercise?.accent] || ACCENT_STYLES.indigo;
                const abbrev = leaderboardTabs.find(
                  (t) => t.key === activeLeaderboardTab
                )?.abbrev;
                const isYou = entry.name === "You";
                const entryState = isYou ? achievementState : mockAchievementStateFor(entry.name);
                // Quad's leaderboard row reverted to a plain decimal score
                // (matching iqnb's style) rather than "D4B · 84%" — this is
                // a leaderboard-display-only override; the real Quad N-Back
                // exercise's own accuracy tracking (Home/Account/Overview)
                // is untouched.
                const isAccuracy =
                  tabExercise?.scoreType === "accuracy" && activeLeaderboardTab !== "quad";
                const avatarId = isYou ? selectedAvatarId : PLACEHOLDER_AVATARS[entry.name];
                const tier = gemTierFor(entry.level);
                const entryFrameTier = isYou ? ownAvatarFrameTier : avatarFrameTier(entryState);
                const entryHasGlow = hasLeaderboardGlow(entryState);
                return (
                  <button
                    key={`${entry.name}-${i}`}
                    onClick={() => {
                      setProfileTarget(isYou ? "you" : entry.name);
                      setProfileBadgesExpanded(false);
                      setMainView("profile");
                    }}
                    className={`group w-full flex items-center gap-6 rounded-lg p-5 border text-left transition-colors ${
                      isYou
                        ? `${tabAccent.bg} ${tabAccent.border} ${tabAccent.hoverBorderStrong}`
                        : "bg-slate-900 border-slate-700/60 hover:border-slate-500"
                    }`}
                    style={
                      entryHasGlow
                        ? { animation: "rankGlowPulse 2.2s ease-in-out infinite" }
                        : undefined
                    }
                  >
                    <div className="w-6 text-center text-lg font-semibold text-slate-500">
                      {rank}
                    </div>
                    <AvatarFrame tier={entryFrameTier}>
                      <Avatar avatarId={avatarId} imageUrl={isYou ? customAvatarImage : undefined} size={36} />
                    </AvatarFrame>
                    <div
                      className={`flex-1 text-lg font-medium underline-offset-4 group-hover:underline ${
                        isYou ? tabAccent.text : "text-slate-100"
                      }`}
                    >
                      {isYou ? displayName : entry.name}
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <div className="text-base text-slate-300">
                          {isAccuracy
                            ? `${abbrev}${entry.level}B · ${entry.accuracy}%`
                            : activeLeaderboardTab === "quad"
                            ? entry.score.toFixed(2)
                            : formatScoreValue(tabExercise, entry.score)}
                        </div>
                        <div
                          className="text-sm font-semibold tracking-wide"
                          style={{ color: tier.color }}
                        >
                          {tier.label}
                        </div>
                      </div>
                      <LevelGem level={entry.level} size={32} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mainView === "profile" && profileTarget && (
          <div className="space-y-12">
            <button
              onClick={() => {
                setProfileTarget(null);
                setMainView("leaderboard");
              }}
              className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium"
            >
              ‹ Back
            </button>

            <div className={`rounded-2xl bg-gradient-to-br ${profileBackground.grad} p-8`}>
              <div className="flex flex-col items-center text-center gap-5">
                <AvatarFrame tier={profileFrameTier}>
                  <Avatar avatarId={profileAvatarId} imageUrl={profileImageUrl} size={88} />
                </AvatarFrame>
                <div>
                  <h1 className={`text-3xl font-semibold tracking-tight ${ACCENT_STYLES[profileColorId].text}`}>
                    {profileDisplayName}
                  </h1>
                  {profileFrameTier !== "none" && (
                    <div className="text-sm text-slate-400 mt-1">
                      {profileFrameTier === "aura"
                        ? "✨ Animated aura equipped"
                        : profileFrameTier === "splitTone"
                        ? "Split-tone frame equipped"
                        : "Glow frame equipped"}
                    </div>
                  )}
                  {isOwnProfile && bio && (
                    <div className="text-slate-300 text-base mt-2 max-w-xs">{bio}</div>
                  )}
                  {profileFeaturedBadge && (
                    <div
                      className={`inline-flex items-center gap-2 mt-4 rounded-full pl-1.5 pr-4 py-1.5 border ${ACCENT_STYLES[GROUP_ACCENTS[profileFeaturedBadge.group]].bg} ${ACCENT_STYLES[GROUP_ACCENTS[profileFeaturedBadge.group]].border}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm bg-gradient-to-br ${ACCENT_STYLES[GROUP_ACCENTS[profileFeaturedBadge.group]].grad}`}
                      >
                        {profileFeaturedBadge.icon}
                      </span>
                      <span className="text-sm font-medium text-slate-100">
                        {profileFeaturedBadge.title}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(profileState.exerciseStats || {}).map(([key, stat]) => {
                const ex = EXERCISE_LIBRARY[key];
                if (!ex) return null;
                const acc = ACCENT_STYLES[ex.accent];
                const isAccuracy = ex.scoreType === "accuracy";
                const scoreLabel = isAccuracy
                  ? `${ex.abbrev}${stat.bestN}B · ${formatScoreValue(ex, stat.bestAccuracy)}`
                  : formatScoreValue(ex, stat.bestAccuracy);
                return (
                  <div key={key} className={`${acc.bg} border ${acc.border} rounded-xl p-5`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${acc.dot}`} />
                      <div className="text-base font-semibold text-slate-100">
                        {ex.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <LevelGem level={stat.bestN} size={28} />
                      <div className={`text-base font-medium ${acc.text}`}>
                        {scoreLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <button
                onClick={() => setProfileBadgesExpanded((v) => !v)}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
              >
                <span>Badges</span>
                <span className="text-slate-500 text-base font-normal">
                  {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, profileState)).length}/
                  {ACHIEVEMENTS_CATALOG.length} {profileBadgesExpanded ? "︿" : "›"}
                </span>
              </button>
              {profileBadgesExpanded && (
                <div className="mt-5">
                  <BadgeGrid
                    state={profileState}
                    onSelectBadge={(a) => setBadgeDetail({ achievement: a, state: profileState })}
                    hideHeader
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {mainView === "tutorial" && (
          <div className="space-y-14">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                {tutorialStepExercise.title}
              </h1>
            </div>

            <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-8">
              <p className="text-slate-300 text-lg">
                {TUTORIAL_CONTENT[tutorialStepExercise.key]}
              </p>
            </div>

            <button
              onClick={() => {
                if (isLastTutorialStep) {
                  setMainView("home");
                } else {
                  setTutorialStep((i) => i + 1);
                }
              }}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30"
            >
              Next
            </button>
          </div>
        )}

        {mainView === "account" && (
          <div className="space-y-14">
            <div>
              <button
                onClick={() => {
                  // Closing the account view — collapse the Badges grid so it
                  // isn't sitting open the next time the person opens Account.
                  setBadgesExpanded(false);
                  setMainView("home");
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-3"
              >
                ‹ Back
              </button>
              <h1 className="text-4xl font-semibold tracking-tight">
                Account
              </h1>
              <p className="text-slate-500 text-base mt-3">
                Mockup only — sign-in comes later.
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <AvatarFrame tier={ownAvatarFrameTier}>
                  <Avatar avatarId={selectedAvatarId} imageUrl={customAvatarImage} size={64} />
                </AvatarFrame>
                <button
                  onClick={() => avatarFileInputRef.current?.click()}
                  title={customAvatarImage ? "Change photo" : "Upload photo"}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 border-2 border-slate-950 flex items-center justify-center transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-slate-200"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                {customAvatarImage && (
                  <button
                    onClick={removeCustomAvatar}
                    title="Remove photo"
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 border-2 border-slate-950 flex items-center justify-center transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="text-slate-300"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    handleAvatarUpload(file);
                    ev.target.value = "";
                  }}
                />
              </div>
              <div className="flex flex-col gap-3">
                {isEditingName ? (
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(ev) => setNameDraft(ev.target.value)}
                    onBlur={() => {
                      setDisplayName(nameDraft);
                      setIsEditingName(false);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") {
                        setDisplayName(nameDraft);
                        setIsEditingName(false);
                      } else if (ev.key === "Escape") {
                        setIsEditingName(false);
                      }
                    }}
                    maxLength={24}
                    className="text-2xl font-semibold text-slate-100 bg-transparent border-b border-indigo-500 focus:outline-none w-40"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setNameDraft(displayName);
                      setIsEditingName(true);
                    }}
                    className="flex items-center gap-4 text-2xl font-semibold text-slate-100 hover:text-indigo-300 transition-colors group"
                  >
                    {displayName}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-slate-500 group-hover:text-indigo-300 transition-colors"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                )}
                {avatarUploadError && (
                  <div className="text-sm text-rose-400">{avatarUploadError}</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-lg text-slate-300">Bio</div>
              {isEditingBio ? (
                <input
                  autoFocus
                  value={bioDraft}
                  onChange={(ev) => setBioDraft(ev.target.value)}
                  onBlur={() => {
                    setBio(bioDraft);
                    setIsEditingBio(false);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      setBio(bioDraft);
                      setIsEditingBio(false);
                    } else if (ev.key === "Escape") {
                      setIsEditingBio(false);
                    }
                  }}
                  maxLength={100}
                  placeholder="Say a little about yourself…"
                  className="w-full text-base text-slate-100 bg-slate-900 border border-slate-700/70 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-3"
                />
              ) : (
                <button
                  onClick={() => {
                    setBioDraft(bio);
                    setIsEditingBio(true);
                  }}
                  className="w-full flex items-center justify-between gap-4 text-left text-base bg-slate-900 hover:bg-slate-800 border border-slate-700/70 rounded-lg px-4 py-3 transition-colors group"
                >
                  <span className={bio ? "text-slate-200" : "text-slate-500 italic"}>
                    {bio || "Add a short bio"}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-slate-500 group-hover:text-indigo-300 transition-colors"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
              )}
            </div>

            <div>
              <button
                onClick={() => setCustomizeExpanded((v) => !v)}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
              >
                <span>Customize profile</span>
                <span className="text-slate-500 text-base font-normal">
                  {customizeExpanded ? "︿" : "›"}
                </span>
              </button>
              {customizeExpanded && (
              <div className="mt-5 space-y-10">
              <div className="space-y-5">
              <div className="text-lg text-slate-300">Choose an avatar</div>
              <div className="grid grid-cols-4 gap-6">
                {AVATAR_OPTIONS.map((a) => {
                  const isSelected = selectedAvatarId === a.id && !customAvatarImage;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAvatarId(a.id)}
                      className={`rounded-lg p-5 flex items-center justify-center border transition-colors ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-950/40"
                          : "border-slate-700/70 bg-slate-900 hover:border-slate-600"
                      }`}
                    >
                      <Avatar avatarId={a.id} size={48} />
                    </button>
                  );
                })}
                {BONUS_AVATAR_OPTIONS.map((a) => {
                  const unlockAchievement = ACHIEVEMENTS_CATALOG.find(
                    (ach) => ach.id === a.unlockedBy
                  );
                  const isUnlocked = unlockAchievement
                    ? isAchievementUnlocked(unlockAchievement, achievementState)
                    : false;
                  const isSelected = selectedAvatarId === a.id && !customAvatarImage;
                  return (
                    <button
                      key={a.id}
                      onClick={() => isUnlocked && setSelectedAvatarId(a.id)}
                      disabled={!isUnlocked}
                      title={
                        isUnlocked
                          ? undefined
                          : `Unlocks with ${unlockAchievement?.title || "an achievement"}`
                      }
                      className={`relative rounded-lg p-5 flex items-center justify-center border transition-colors ${
                        !isUnlocked
                          ? "border-slate-800 bg-slate-900/60 cursor-not-allowed"
                          : isSelected
                          ? "border-indigo-500 bg-indigo-950/40"
                          : "border-slate-700/70 bg-slate-900 hover:border-slate-600"
                      }`}
                    >
                      <div className={!isUnlocked ? "opacity-30 grayscale" : ""}>
                        <Avatar avatarId={a.id} size={48} />
                      </div>
                      {!isUnlocked && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="absolute text-slate-400"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-slate-500 uppercase tracking-wide font-semibold">
                  Avatar frame
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {FRAME_OPTIONS.map((f) => {
                    const unlockAch = ACHIEVEMENTS_CATALOG.find((a) => a.id === f.unlockedBy);
                    const unlocked = isCosmeticUnlocked(f, achievementState);
                    const isActive = selectedFrameId === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => unlocked && setSelectedFrameId(f.id)}
                        disabled={!unlocked}
                        title={unlocked ? undefined : `Unlocks with ${unlockAch?.title || "an achievement"}`}
                        className={`relative rounded-lg p-4 flex flex-col items-center gap-2 border transition-colors ${
                          !unlocked
                            ? "border-slate-800 bg-slate-900/60 cursor-not-allowed"
                            : isActive
                            ? "border-indigo-500 bg-indigo-950/40"
                            : "border-slate-700/70 bg-slate-900 hover:border-slate-600"
                        }`}
                      >
                        <div className={!unlocked ? "opacity-30 grayscale" : ""}>
                          <AvatarFrame tier={f.id}>
                            <Avatar avatarId={selectedAvatarId} imageUrl={customAvatarImage} size={40} />
                          </AvatarFrame>
                        </div>
                        <span className="text-xs text-slate-300">{f.label}</span>
                        {!unlocked && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="absolute top-2 right-2 text-slate-400"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-slate-500 uppercase tracking-wide font-semibold">
                  Profile color
                </div>
                <div className="grid grid-cols-6 gap-3">
                  {PROFILE_COLOR_OPTIONS.map((c) => {
                    const unlockAch = ACHIEVEMENTS_CATALOG.find((a) => a.id === c.unlockedBy);
                    const unlocked = isCosmeticUnlocked(c, achievementState);
                    const isActive = selectedColorId === c.id;
                    const acc = ACCENT_STYLES[c.id];
                    return (
                      <button
                        key={c.id}
                        onClick={() => unlocked && setSelectedColorId(c.id)}
                        disabled={!unlocked}
                        title={unlocked ? c.label : `Unlocks with ${unlockAch?.title || "an achievement"}`}
                        className={`w-full aspect-square rounded-full bg-gradient-to-br ${acc.grad} border-2 transition-transform ${
                          isActive ? "border-white scale-105" : "border-transparent"
                        } ${!unlocked ? "opacity-25 grayscale cursor-not-allowed" : "hover:scale-105"}`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-slate-500 uppercase tracking-wide font-semibold">
                  Profile background
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {PROFILE_BACKGROUND_OPTIONS.map((b) => {
                    const unlockAch = ACHIEVEMENTS_CATALOG.find((a) => a.id === b.unlockedBy);
                    const unlocked = isCosmeticUnlocked(b, achievementState);
                    const isActive = selectedBackgroundId === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => unlocked && setSelectedBackgroundId(b.id)}
                        disabled={!unlocked}
                        title={unlocked ? b.label : `Unlocks with ${unlockAch?.title || "an achievement"}`}
                        className={`relative h-16 rounded-lg bg-gradient-to-br ${b.grad} border-2 flex items-end p-2 transition-colors ${
                          isActive ? "border-white" : "border-transparent"
                        } ${!unlocked ? "opacity-30 grayscale cursor-not-allowed" : "hover:border-slate-500"}`}
                      >
                        <span className="text-xs font-medium text-slate-100">{b.label}</span>
                        {!unlocked && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="absolute top-2 right-2 text-slate-300"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-slate-500 uppercase tracking-wide font-semibold">
                  Featured badge
                </div>
                {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, achievementState)).length === 0 ? (
                  <div className="text-sm text-slate-500">
                    Unlock a badge to feature it on your profile.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, achievementState)).map((a) => {
                      const isActive = featuredBadgeId === a.id;
                      const groupAccent = ACCENT_STYLES[GROUP_ACCENTS[a.group]];
                      return (
                        <button
                          key={a.id}
                          onClick={() => setFeaturedBadgeId(isActive ? null : a.id)}
                          title={a.title}
                          className={`rounded-lg p-3 flex flex-col items-center gap-1.5 border transition-colors ${
                            isActive
                              ? `${groupAccent.bg} ${groupAccent.borderStrong}`
                              : "border-slate-700/70 bg-slate-900 hover:border-slate-600"
                          }`}
                        >
                          <span
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-br ${groupAccent.grad}`}
                          >
                            {a.icon}
                          </span>
                          <span className="text-xs text-slate-300 text-center leading-tight">
                            {a.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              </div>
              )}
            </div>

            <div>
              <button
                onClick={() => setBadgesExpanded((v) => !v)}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-amber-400/40 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/10 rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
              >
                <span>Badges</span>
                <span className="text-slate-500 text-base font-normal">
                  {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, achievementState)).length}/
                  {ACHIEVEMENTS_CATALOG.length} {badgesExpanded ? "︿" : "›"}
                </span>
              </button>
              {badgesExpanded && (
                <div className="mt-5">
                  <BadgeGrid
                    state={achievementState}
                    onSelectBadge={(a) => setBadgeDetail({ achievement: a, state: achievementState })}
                    hideHeader
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const random =
                  ACHIEVEMENTS_CATALOG[Math.floor(Math.random() * ACHIEVEMENTS_CATALOG.length)];
                setAchievementCelebrationQueue((q) => [...q, random]);
              }}
              className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-3 px-6 text-sm"
            >
              🧪 Test: simulate achievement unlock
            </button>

            <button
              onClick={() => setMainView("regime")}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-indigo-400/40 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10 rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
            >
              <span>Regime</span>
              <span className="text-slate-500 text-base font-normal">
                {REGIMES.find((r) => r.key === regimeKey)?.title || "Choose"} ›
              </span>
            </button>

            <button
              onClick={() => setMainView("membership")}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-emerald-400/40 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/10 rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
            >
              <span>Membership</span>
              <span className="text-slate-500 text-base font-normal capitalize">
                {membershipPlan} ›
              </span>
            </button>

            {/* Diagnostics — surfaces failed storage writes and thrown
                errors that used to fail completely silently (see
                logClientError/safeStorageSet/AppErrorBoundary near the top
                of the file). Not hidden behind anything — a regression like
                "RRT stopped saving" should be visible here instead of only
                ever showing up as a user report. */}
            <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-slate-400 text-base uppercase tracking-wide">
                    Diagnostics
                  </div>
                  <div
                    className={`text-lg mt-1 ${errorLog.length > 0 ? "text-amber-400" : "text-slate-200"}`}
                  >
                    {errorLog.length === 0
                      ? "No errors logged"
                      : `${errorLog.length} error${errorLog.length === 1 ? "" : "s"} logged`}
                  </div>
                </div>
                {errorLog.length > 0 && (
                  <button
                    onClick={clearErrorLog}
                    className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
              {errorLog.length > 0 && (
                <div className="mt-5 space-y-3 max-h-56 overflow-y-auto">
                  {[...errorLog].reverse().slice(0, 10).map((entry, i) => (
                    <div
                      key={`${entry.ts}-${i}`}
                      className="text-xs border-t border-slate-800 pt-3 first:border-0 first:pt-0"
                    >
                      <div className="text-slate-500">
                        {new Date(entry.ts).toLocaleString()}
                      </div>
                      <div className="text-amber-400 font-medium mt-0.5">
                        {entry.context}
                      </div>
                      {entry.message && (
                        <div className="text-slate-500 mt-0.5 break-words">
                          {entry.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {mainView === "membership" && (
          <div className="space-y-14">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                Membership
              </h1>
              <p className="text-slate-500 text-base mt-3">
                Placeholder only — no billing is connected yet.
              </p>
            </div>

            {isAchievementUnlocked(
              ACHIEVEMENTS_CATALOG.find((a) => a.id === "regimeStreak7"),
              achievementState
            ) && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-5 text-emerald-300 text-base flex items-center gap-3">
                <span className="text-2xl">🎁</span>
                <span>Free month applied — 7-Day Regime Streak reward</span>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-7">
              <div className="text-slate-400 text-base uppercase tracking-wide">
                Current plan
              </div>
              <div className="text-2xl font-semibold mt-2 capitalize">
                {membershipPlan === "canceled" ? "Canceled" : membershipPlan}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {membershipPlan !== "annual" && (
                <button
                  onClick={() => setMembershipPlan("annual")}
                  className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium"
                >
                  Switch to annual
                </button>
              )}
              {membershipPlan !== "monthly" && (
                <button
                  onClick={() => setMembershipPlan("monthly")}
                  className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium"
                >
                  Switch to monthly
                </button>
              )}
              {membershipPlan !== "canceled" && (
                <button
                  onClick={() => setMembershipPlan("canceled")}
                  className="w-full bg-red-950/40 hover:bg-red-950/60 border border-red-900 text-red-400 transition-colors rounded-lg py-5 text-xl font-medium"
                >
                  Cancel membership
                </button>
              )}
            </div>

            <button
              onClick={() => setMainView("account")}
              className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
            >
              Back
            </button>
          </div>
        )}

        {mainView === "app" && (
        <>
        {!switchNotice && exercise.key !== "overview" && exercise.key !== "motion3d" && (
          <div className="flex items-center justify-between mb-6">
            <div>
              {screen !== "running" &&
                screen !== "results" &&
                (exercise.key !== "rrt" || rrtStage === "setup") &&
                !(exercise.key === "iqnb" && sessionStartedRef.current.iqnb) &&
                exercise.key !== "motion3d" && (
                <button
                  onClick={() => setMainView("home")}
                  className="text-slate-500 hover:text-slate-300 transition-colors text-base"
                >
                  ← Home
                </button>
              )}
            </div>
            {!!exerciseElapsedMs[exercise.key] && (
              <div className="text-slate-300 text-sm font-medium">
                {formatDuration(exerciseElapsedMs[exercise.key])}
              </div>
            )}
          </div>
        )}

        {!switchNotice &&
          screen === "setup" &&
          exercise.key !== "overview" &&
          exercise.key !== "motion3d" &&
          (exercise.key !== "rrt" || rrtStage === "setup") && (
          <div className={`text-center text-base uppercase tracking-wide font-semibold mb-6 ${ACCENT_STYLES[exercise.accent]?.text || "text-indigo-400"}`}>
            Exercise {exerciseIndex + 1} of {activeExercises.length - 1}
          </div>
        )}

        {switchNotice && (
          <div className="space-y-5 text-center">
            <div className="text-5xl">⏱</div>
            <h1 className="text-3xl font-semibold">Well done! Next exercise</h1>
          </div>
        )}

        {!switchNotice && levelChangeNotice && (
          <div className="text-base rounded-lg px-5 py-2 mb-6 border text-amber-400 bg-amber-950/40 border-amber-800">
            Below {PASS_THRESHOLD}% three times in a row — N level dropped to {n}.
          </div>
        )}

        {!switchNotice && exercise.key === "overview" && overviewView === "summary" && (
          <div className="space-y-14">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                Overview
              </h1>
            </div>

            <Stat
              label={overviewSource === "home" ? "Total duration" : "Duration today"}
              value={formatDuration(
                overviewSource === "home"
                  ? msTrainedTotal(exerciseHistory)
                  : msTrainedToday(exerciseHistory)
              )}
            />

            {overviewExercises.map((e) => {
              const stat = exerciseStats[e.key];
              const isAccuracy = e.scoreType === "accuracy";
              const avgVal = stat ? stat.totalAccuracy / stat.sessions : null;
              const bestLabel = isAccuracy ? "Best accuracy" : "Best score";
              const avgLabel = isAccuracy ? "Avg accuracy" : "Avg score";
              const bestValue = stat
                ? e.key === "motion3d"
                  ? formatScoreValue(e, stat.bestAccuracy)
                  : e.key === "iqnb"
                  ? `${e.abbrev} · ${formatScoreValue(e, stat.bestAccuracy)}`
                  : e.key === "rrt"
                  ? `${formatScoreValue(e, stat.bestAccuracy)} ${stat.bestStreak ?? 0}/20`
                  : `${e.abbrev}${stat.bestN}${isAccuracy ? "B" : ""} · ${formatScoreValue(
                      e,
                      stat.bestAccuracy
                    )}`
                : "—";
              const avgValue = stat ? formatScoreValue(e, avgVal) : "—";
              return (
                <div key={e.key} className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${ACCENT_STYLES[e.accent].dot}`} />
                    {e.title}
                  </h2>
                  <div className="grid grid-cols-2 gap-6">
                    <Stat
                      size="sm"
                      label={bestLabel}
                      value={bestValue}
                      color={stat && isAccuracy ? accuracyColor(stat.bestAccuracy) : undefined}
                      accent={ACCENT_STYLES[e.accent]}
                    />
                    <Stat
                      size="sm"
                      label={avgLabel}
                      value={avgValue}
                      color={stat && isAccuracy ? accuracyColor(avgVal) : undefined}
                      accent={ACCENT_STYLES[e.accent]}
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex gap-6 pt-4">
              <button
                onClick={() => setOverviewView("graph")}
                className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                Stats
              </button>
              <button
                onClick={() => setMainView("home")}
                className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                Home
              </button>
            </div>
          </div>
        )}

        {!switchNotice && exercise.key === "overview" && overviewView === "graph" && (
          <div className="space-y-14">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-semibold tracking-tight">
                Accuracy Over Time
              </h1>
              <button
                onClick={() =>
                  setStatsDisplay((v) => (v === "chart" ? "spreadsheet" : "chart"))
                }
                className="shrink-0 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-2 px-5 text-base font-medium"
              >
                {statsDisplay === "chart" ? "Spreadsheet" : "Graph"}
              </button>
            </div>

            {statsDisplay === "chart"
              ? overviewExercises.map((e) => {
              const history = exerciseHistory[e.key] || [];
              const isAccuracy = e.scoreType === "accuracy";
              const chartData = history.map((h, i) => ({
                session: i + 1,
                accuracy: h.accuracy,
                n: h.n,
              }));
              return (
                <div key={e.key} className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{e.title}</h2>
                  {chartData.length > 0 ? (
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-6 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="session"
                            stroke="#64748b"
                            tick={{ fill: "#64748b", fontSize: 12 }}
                            label={{
                              value: "Session",
                              position: "insideBottom",
                              offset: -4,
                              fill: "#64748b",
                              fontSize: 12,
                            }}
                          />
                          <YAxis
                            domain={isAccuracy ? [0, 100] : ["auto", "auto"]}
                            stroke="#64748b"
                            tick={{ fill: "#64748b", fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#0f172a",
                              border: "1px solid #1e293b",
                              borderRadius: 8,
                              color: "#e2e8f0",
                            }}
                            formatter={(value, name, props) => [
                              isAccuracy
                                ? `${value}% (N${props.payload.n})`
                                : formatScoreValue(e, value),
                              isAccuracy ? "Accuracy" : "Score",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="accuracy"
                            stroke="#818cf8"
                            strokeWidth={2}
                            dot={{ r: 3, fill: "#818cf8" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-8 text-center text-slate-500 text-base">
                      No completed sessions yet.
                    </div>
                  )}
                </div>
              );
            })
              : overviewExercises.map((e) => {
              const rows = buildExerciseDailyRows(exerciseHistory[e.key]);
              const isAccuracy = e.scoreType === "accuracy";
              return (
                <div key={e.key} className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${ACCENT_STYLES[e.accent].dot}`} />
                    {e.title}
                  </h2>
                  {rows.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-8 text-center text-slate-500 text-base">
                      No completed sessions yet.
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700/70 text-left text-slate-500">
                            <th className="px-4 py-2.5 font-medium">Day</th>
                            <th className="px-4 py-2.5 font-medium">Date</th>
                            <th className="px-4 py-2.5 font-medium">Time</th>
                            <th className="px-4 py-2.5 font-medium">
                              {isAccuracy ? "Level" : "Score"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const d = new Date(row.ts);
                            return (
                              <tr
                                key={row.dateKey}
                                className={`border-b border-slate-800/70 last:border-0 ${
                                  row.missed ? "bg-red-500/10" : "bg-emerald-500/10"
                                }`}
                              >
                                <td className="px-4 py-2.5 text-slate-400">
                                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                                </td>
                                <td className="px-4 py-2.5 text-slate-400">
                                  {d.toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2.5 text-slate-400">
                                  {row.missed ? "—" : formatDuration(row.durationMs)}
                                </td>
                                <td className="px-4 py-2.5 text-slate-100 font-medium">
                                  {row.missed
                                    ? "—"
                                    : isAccuracy
                                    ? `${e.abbrev}${row.n}B ${row.accuracy}%`
                                    : formatScoreValue(e, row.accuracy)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => setOverviewView("summary")}
              className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
            >
              Back
            </button>
          </div>
        )}

        {!switchNotice && exercise.key === "rrt" && (
          <div className="max-w-xs mx-auto mb-4 bg-slate-900 border border-slate-700/70 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-base font-medium text-slate-100">
                  Branching premises
                </div>
                <div className="text-sm text-slate-500 mt-0.5">
                  Lets one item be defined relative to 3+ others (e.g. B, C,
                  and D each linked straight to A) instead of every item
                  touching at most 2 premises. Leave on if unsure. Has no
                  effect at 0% Scramble below — that setting always uses a
                  straight chain so every premise is guaranteed to link to
                  the next.
                </div>
              </div>
              <Toggle
                on={rrtBranchingEnabled}
                onToggle={() => setRrtBranchingEnabled(!rrtBranchingEnabled)}
                accent={ACCENT_STYLES[exercise.accent]}
              />
            </div>
          </div>
        )}

        {!switchNotice && exercise.key === "rrt" && (
          <div className="max-w-xs mx-auto mb-4 bg-slate-900/60 border border-dashed border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>🧪 Scramble Factor (testing)</span>
              <span className="text-slate-200 font-medium">
                {Math.round(rrtScrambleFactor * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(rrtScrambleFactor * 100)}
              onChange={(e) => setRrtScrambleFactor(Number(e.target.value) / 100)}
              className="w-full accent-teal-500"
            />
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span>Unscrambled</span>
              <span>Scrambled</span>
            </div>
          </div>
        )}

        {!switchNotice && exercise.key === "rrt" && (
          <RRTExercise
            exercise={exercise}
            onFinish={() => forceSwitchToNext(exerciseIndex)}
            onStageChange={setRrtStage}
            onLevelUp={recordRrtLevelUp}
            onSessionEnd={recordRrtSessionEnd}
            paused={!!unlockInfo || achievementCelebrationQueue.length > 0}
            scrambleFactor={rrtScrambleFactor}
            branchingEnabled={rrtBranchingEnabled}
          />
        )}

        {!switchNotice && exercise.key === "motion3d" && (
          <Motion3DExercise
            exercise={exercise}
            onFinish={() => forceSwitchToNext(exerciseIndex)}
            onStageChange={setMotion3dStage}
            onLevelUp={recordMotion3dLevelUp}
            onSessionEnd={recordMotion3dSessionEnd}
            onResetProgress={resetMotion3dProgress}
            paused={!!unlockInfo || achievementCelebrationQueue.length > 0}
          />
        )}

        {!switchNotice &&
          exercise.modalities.length === 0 &&
          exercise.key !== "overview" &&
          exercise.key !== "rrt" &&
          exercise.key !== "motion3d" && (
          <div className="space-y-14 text-center">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                {exercise.title}
              </h1>
              {exercise.sessionDurationMs && (
                <p className="text-slate-500 text-base mt-3">
                  {Math.round(exercise.sessionDurationMs / 60000)} minutes
                </p>
              )}
            </div>

            <div className={`${ACCENT_STYLES[exercise.accent].bg} border ${ACCENT_STYLES[exercise.accent].border} rounded-xl p-12 space-y-4`}>
              <div className="text-5xl">🚧</div>
              <div className="text-xl font-semibold text-slate-100">Coming soon</div>
              <p className="text-slate-400 text-base">{exercise.description}</p>
            </div>

            <button
              onClick={() => forceSwitchToNext(exerciseIndex)}
              className={`w-full bg-gradient-to-r ${ACCENT_STYLES[exercise.accent].grad} hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
            >
              Continue
            </button>
          </div>
        )}

        {!switchNotice && exercise.modalities.length > 0 && screen === "setup" && (
          <div className="space-y-14">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                {exercise.title}
              </h1>
              {exercise.key === "iqnb" && (
                <p className="text-slate-500 text-base mt-3">Incremental N-back version</p>
              )}
              {exercise.sessionDurationMs && (
                <p className="text-slate-500 text-base mt-3">
                  {Math.round(exercise.sessionDurationMs / 60000)} minutes
                </p>
              )}
            </div>

            <div className={`${ACCENT_STYLES[exercise.accent].bg} border ${ACCENT_STYLES[exercise.accent].border} rounded-xl p-6 space-y-3`}>
              <div className="flex items-center gap-4">
                <LevelGem
                  level={exercise.key === "iqnb" ? Math.floor(qnbPrimeLevel) : n}
                  size={48}
                />
                <div>
                  <div className="text-lg text-slate-300">
                    Level:{" "}
                    <span className="text-slate-100 font-medium">
                      {exercise.key === "iqnb" ? qnbPrimeLevel.toFixed(2) : n}
                    </span>
                  </div>
                  <div className="text-lg text-slate-400">
                    Trials:{" "}
                    <span className="text-slate-200 font-medium">
                      {exercise.key === "iqnb"
                        ? trialsForLevel(Math.floor(qnbPrimeLevel))
                        : trialCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {exercise.modalities.includes("audio") && (
              <div className="bg-slate-900 border border-slate-700/70 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-base font-medium text-slate-100">Binaural beats</div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      40Hz Gamma tone, played quietly underneath the exercise audio
                    </div>
                  </div>
                  <Toggle
                    on={binauralBeatsEnabled}
                    onToggle={() => {
                      unlockBinauralAudio();
                      setBinauralBeatsEnabled(!binauralBeatsEnabled);
                    }}
                    accent={ACCENT_STYLES[exercise.accent]}
                  />
                </div>
                {binauralAudioError && (
                  <div className="text-sm text-rose-400">⚠ {binauralAudioError}</div>
                )}
              </div>
            )}

            {exercise.key !== "iqnb" && (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-base font-medium text-slate-100">
                      Interference
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      Chance a non-match reuses an item from n±1 trials ago — a
                      deliberate near-miss to keep you honest. Higher = trickier.
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-slate-100 shrink-0">
                    {Math.round(interference * 100)}%
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={32}
                  step={1}
                  value={Math.round(interference * 100)}
                  onChange={(e) => setInterference(Number(e.target.value) / 100)}
                  className="w-full accent-current"
                />
              </div>
            )}

            <button
              onClick={() => startTask(exercise, n)}
              className={`w-full bg-gradient-to-r ${ACCENT_STYLES[exercise.accent].grad} hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
            >
              Start
            </button>

            <div className="flex flex-col gap-4">
              {exercise.sessionDurationMs && activeExercises[exerciseIndex + 1] && (
                <button
                  onClick={() => forceSwitchToNext(exerciseIndex)}
                  className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-3 text-base"
                >
                  🧪 Test: skip to session-timeout switch
                </button>
              )}
              {exercise.key === "iqnb" ? (
                <>
                  <button
                    onClick={() => setQnbPrimeLastDelta(recordQnbPrimeResult(20))}
                    className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-3 text-base"
                  >
                    🧪 Test: simulate a bad run (~20%)
                  </button>
                  <button
                    onClick={() => setQnbPrimeLastDelta(recordQnbPrimeResult(85))}
                    className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-3 text-base"
                  >
                    🧪 Test: simulate a good run (~85%)
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => recordSessionResult(0, exercise.key, n)}
                    className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-3 text-base"
                  >
                    🧪 Test: simulate a failing run ({(lowScoreStreak[exercise.key] || 0)}/3)
                  </button>
                  <button
                    onClick={() => recordSessionResult(80, exercise.key, n)}
                    className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-3 text-base"
                  >
                    🧪 Test: simulate a passing run (80%+)
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!switchNotice && screen === "running" && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <div className={`text-3xl font-semibold tracking-tight ${ACCENT_STYLES[exercise.accent].text}`}>
                {exercise.key === "iqnb"
                  ? `${exercise.title} ${qnbPrimeLevel.toFixed(2)}`
                  : exercise.title.replace("N-Back", `${n}-Back`)}
              </div>
              <div className="text-slate-400 text-lg mt-2">
                {trialCount - index}
              </div>
            </div>

            <div className="grid grid-cols-3 grid-rows-3 gap-6 w-full aspect-square">
              {POSITIONS.map((cellIdx) => {
                const isActive = activeCell === cellIdx;
                const shapeType = exercise.modalities.includes("shape")
                  ? sequence.shape?.[index]
                  : "square";
                const color = exercise.modalities.includes("color")
                  ? sequence.color?.[index]
                  : "#818cf8";
                const hasShapeOrColor =
                  exercise.modalities.includes("shape") ||
                  exercise.modalities.includes("color");
                return (
                  <div
                    key={cellIdx}
                    className={`rounded-xl border flex items-center justify-center overflow-hidden transition-colors ${
                      isActive
                        ? "bg-stone-200 border-stone-300"
                        : `bg-slate-900 ${ACCENT_STYLES[exercise.accent].border}`
                    }`}
                  >
                    {isActive && hasShapeOrColor && (
                      exercise.key === "iqnb" ? (
                        <VoronoiShapeIcon
                          shape={shapeType}
                          color={color}
                          seed={`${index}-${shapeType}-${color}`}
                          size={96}
                        />
                      ) : (
                        <ShapeIcon shape={shapeType} color={color} size={96} />
                      )
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-6 w-full">
              {exercise.modalities.map((m) => {
                const meta = MODALITY_META[m];
                const state = feedback[m];
                const cls =
                  state === "wrong"
                    ? "bg-red-500"
                    : state === "correct"
                    ? BUTTON_PULSE
                    : BUTTON_BASE;
                return (
                  <button
                    key={m}
                    onClick={() => handlePress(m)}
                    className={`transition-colors duration-150 rounded-lg py-5 font-semibold text-xl ${cls}`}
                  >
                    {meta.label}{" "}
                    <span className="text-base font-normal opacity-70">
                      ({MODALITY_KEY_LABEL[m]})
                    </span>
                  </button>
                );
              })}
            </div>

            {exercise.sessionDurationMs && activeExercises[exerciseIndex + 1] && (
              <button
                onClick={() => forceSwitchToNext(exerciseIndex)}
                className="border border-dashed border-slate-700 text-slate-500 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 px-6 text-base"
              >
                🧪 Test: skip to session-timeout switch
              </button>
            )}
          </div>
        )}

        {!switchNotice && screen === "results" && (
          <div className="space-y-14">
            {Object.keys(newPRBanners).length > 0 && (
              <div className="grid grid-cols-1 gap-5">
                {Object.values(EXERCISE_LIBRARY).filter((e) => newPRBanners[e.key]).map((e) => (
                  <div
                    key={e.key}
                    className="text-base rounded-lg px-5 py-2 border text-emerald-400 bg-emerald-950/40 border-emerald-800"
                  >
                    🎉 New PR! {newPRBanners[e.key]} achieved!
                  </div>
                ))}
              </div>
            )}

            <h1 className="text-4xl font-semibold tracking-tight">Results</h1>
            <div className="text-slate-400 text-lg -mt-6">
              Accuracy:{" "}
              <span
                className="font-semibold"
                style={{ color: accuracyColor(overallAccuracy) }}
              >
                {overallAccuracy}%
              </span>
            </div>

            {exercise.key === "iqnb" && qnbPrimeLastDelta != null && (
              <div className="text-base rounded-lg px-5 py-2 border text-slate-200 bg-slate-800/40 border-slate-700">
                {qnbPrimeLevel.toFixed(2)}
              </div>
            )}


            <div className="grid grid-cols-2 gap-6">
              {exercise.modalities.map((m) => (
                <Stat
                  key={m}
                  label={MODALITY_META[m].label}
                  value={`${accuracyFor(m)}%`}
                  color={accuracyColor(accuracyFor(m))}
                  accent={ACCENT_STYLES[exercise.accent]}
                />
              ))}
            </div>

            <button
              onClick={() => startTask(exercise, n)}
              className={`w-full bg-gradient-to-r ${ACCENT_STYLES[exercise.accent].grad} hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
            >
              Continue <span className="text-base font-normal opacity-70">(space)</span>
            </button>
          </div>
        )}
        </>
        )}
      </div>

      {unlockInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-8">
          <div className="relative flex flex-col items-center text-center gap-10 max-w-sm">
            <div className="text-base uppercase tracking-wide text-slate-400">
              {unlockInfo.isNewPR ? "New personal record" : "Level up"}
            </div>

            <div className="relative" style={{ animation: "gemPop 0.7s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <LevelGem level={unlockInfo.level} size={168} glowPulse={gemTierFor(unlockInfo.level).glow} />
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-semibold tracking-tight">
                {unlockInfo.title}
              </div>
              {unlockInfo.isNewPR && (
                <div
                  className="text-lg font-semibold tracking-wide"
                  style={{ color: gemTierFor(unlockInfo.level).color }}
                >
                  {gemTierFor(unlockInfo.level).label} tier unlocked
                </div>
              )}
            </div>

            {/* Dismisses the overlay — doesn't navigate anywhere, so
                whatever screen was underneath (results, mid-session, etc.)
                picks up exactly where it was, letting them carry on with
                the rest of their session instead of getting bounced out.
                Also explicitly re-checks for newly-unlocked achievements
                right here (see checkForNewAchievements) so that if this
                level-up also crossed an achievement threshold, that
                celebration is guaranteed to be queued and chains in
                immediately, rather than possibly trailing in later. */}
            <button
              onClick={() => {
                setUnlockInfo(null);
                checkForNewAchievements();
              }}
              className={`w-full max-w-xs bg-gradient-to-r ${
                ACCENT_STYLES[EXERCISE_LIBRARY[unlockInfo.exerciseKey]?.accent]?.grad ||
                ACCENT_STYLES.indigo.grad
              } hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {!unlockInfo && achievementCelebrationQueue.length > 0 && (() => {
        const current = achievementCelebrationQueue[0];
        const groupAccent = ACCENT_STYLES[GROUP_ACCENTS[current.group]];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-8">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => {
                const left = (i * 41) % 100;
                const delay = (i % 10) * 0.22;
                const duration = 2.4 + (i % 5) * 0.4;
                const emoji = ["🎉", "✨", "⭐", "🎊"][i % 4];
                return (
                  <div
                    key={`e${i}`}
                    className="absolute text-2xl"
                    style={{
                      left: `${left}%`,
                      top: "-40px",
                      animation: `confettiFall ${duration}s ease-in ${delay}s infinite`,
                    }}
                  >
                    {emoji}
                  </div>
                );
              })}
              {Array.from({ length: 36 }).map((_, i) => {
                const left = (i * 27 + 13) % 100;
                const delay = (i % 12) * 0.18;
                const duration = 2.2 + (i % 6) * 0.35;
                const color = ["#f59e0b", "#ec4899", "#8b5cf6", "#22d3ee", "#4ade80", "#f472b6"][i % 6];
                const isRound = i % 3 === 0;
                return (
                  <div
                    key={`c${i}`}
                    className={isRound ? "absolute rounded-full" : "absolute rounded-sm"}
                    style={{
                      left: `${left}%`,
                      top: "-20px",
                      width: isRound ? 8 : 10,
                      height: isRound ? 8 : 6,
                      backgroundColor: color,
                      animation: `confettiFall ${duration}s ease-in ${delay}s infinite`,
                    }}
                  />
                );
              })}
            </div>

            <div
              className="relative flex flex-col items-center text-center gap-8 max-w-sm"
              style={{ animation: "celebrationPop 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}
            >
              <div className="text-base uppercase tracking-wide text-violet-300 font-semibold">
                Achievement unlocked
              </div>

              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center text-6xl bg-gradient-to-br ${groupAccent.grad} shadow-2xl shadow-black/40`}
              >
                {current.icon}
              </div>

              <div className="space-y-2">
                <div className="text-3xl font-semibold tracking-tight text-slate-100">
                  {current.title}
                </div>
                <div className="text-slate-400 text-base">{current.description}</div>
                {current.reward && (
                  <div className={`italic text-sm mt-1 ${groupAccent.text}`}>
                    Unlocks: {current.reward}
                  </div>
                )}
              </div>
              <button
                onClick={() => setAchievementCelebrationQueue((q) => q.slice(1))}
                className={`w-full max-w-xs bg-gradient-to-r ${groupAccent.grad} hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
              >
                Accept
              </button>
            </div>
          </div>
        );
      })()}

      {badgeDetail && (() => {
        const a = badgeDetail.achievement;
        const isUnlocked = isAchievementUnlocked(a, badgeDetail.state);
        const groupAccent = ACCENT_STYLES[GROUP_ACCENTS[a.group]];
        const progressText = !isUnlocked && a.progress ? a.progress(badgeDetail.state) : null;
        const isOwnBadge = badgeDetail.state === achievementState;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-8"
            onClick={() => setBadgeDetail(null)}
          >
            <div
              className="relative flex flex-col items-center text-center gap-6 max-w-sm bg-slate-900 border border-slate-700/70 rounded-2xl p-8 shadow-2xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl border ${
                  isUnlocked
                    ? `bg-gradient-to-br ${groupAccent.grad} ${groupAccent.borderStrong} shadow-lg shadow-black/30`
                    : "bg-slate-800 border-slate-700 grayscale opacity-50"
                }`}
              >
                {a.icon}
              </div>
              <div className="space-y-2">
                <div className={`text-xs uppercase tracking-wide font-semibold ${groupAccent.text}`}>
                  {a.group}
                </div>
                <div className="text-2xl font-semibold tracking-tight text-slate-100">
                  {a.title}
                </div>
                <div className="text-slate-400 text-base">{a.description}</div>
                {a.reward && (
                  <div className={`italic text-sm mt-1 ${groupAccent.text}`}>
                    Unlocks: {a.reward}
                  </div>
                )}
                <div className="pt-2">
                  {isUnlocked ? (
                    <span className={`text-sm font-semibold ${groupAccent.text}`}>
                      ✓ Achieved
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">
                      {progressText || "Locked"}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setBadgeDetail(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-4 font-medium text-lg"
              >
                Close
              </button>
              {isOwnBadge && (
                <button
                  onClick={() => {
                    setSimulatedUnlockedIds((ids) => new Set(ids).add(a.id));
                    setAchievementCelebrationQueue((q) => [...q, a]);
                    setBadgeDetail(null);
                  }}
                  className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2.5 text-sm"
                >
                  🧪 {isUnlocked ? "Replay celebration" : "Simulate unlock"}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {streakCardOpen && (() => {
        const streak = achievementState.streak;
        const trainedDays = trainedDateStrings(exerciseHistory);
        const weekDates = currentWeekDates();
        const todayStr = new Date().toDateString();
        const trainedToday = trainedDays.has(todayStr);
        const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-8"
            onClick={() => setStreakCardOpen(false)}
          >
            <div
              className="w-full max-w-xs bg-slate-900 border border-orange-400/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl shadow-orange-950/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div
                  className="text-7xl font-bold text-orange-400"
                  style={{ filter: "drop-shadow(0 0 18px rgba(251,146,60,0.5))" }}
                >
                  {streak}
                </div>
                <div className="text-slate-400 text-base mt-1">
                  day{streak === 1 ? "" : "s"} streak
                </div>
              </div>

              <div className="text-lg font-semibold text-slate-100">
                {streak === 0
                  ? "Start a streak with one session"
                  : trainedToday
                  ? "You trained today — streak's safe!"
                  : "Train today to keep your streak alive"}
              </div>

              <div className="flex items-center justify-between">
                {weekDates.map((d, i) => {
                  const dStr = d.toDateString();
                  const isToday = dStr === todayStr;
                  const isTrained = trainedDays.has(dStr);
                  return (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div
                        className={`text-xs font-semibold ${
                          isToday ? "text-orange-400" : "text-slate-500"
                        }`}
                      >
                        {DAY_LETTERS[i]}
                      </div>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                          isTrained
                            ? "bg-gradient-to-br from-orange-400 to-red-500 text-white"
                            : isToday
                            ? "bg-slate-800 border-2 border-orange-400/60"
                            : "bg-slate-800 border border-slate-700"
                        }`}
                      >
                        {isTrained ? "🔥" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setStreakCardOpen(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-3 font-medium text-base"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}

      {restDayConfirm && (() => {
        const regime = REGIMES.find((r) => r.key === restDayConfirm.regimeKey);
        const isSwitch = restDayConfirm.reason === "switch";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-8"
            onClick={cancelRestDayTraining}
          >
            <div
              className="w-full max-w-xs bg-slate-900 border border-rose-400/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl shadow-rose-950/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl">⚠️</div>
              <div className="text-lg font-semibold text-slate-100">
                {isSwitch
                  ? "Are you sure you want to change regime?"
                  : `Today's a rest day for ${regime?.title}`}
              </div>
              <p className="text-slate-400 text-sm">
                {isSwitch
                  ? `This will reset your ${restDayConfirm.streak}-day streak in ${regime?.title} regime.`
                  : `Training today will reset your ${restDayConfirm.streak}-day streak in ${regime?.title} regime.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelRestDayTraining}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-3 font-medium text-base"
                >
                  {isSwitch ? "Cancel" : "Rest today"}
                </button>
                <button
                  onClick={confirmRestDayTraining}
                  className="flex-1 bg-gradient-to-r from-rose-600 to-red-500 hover:opacity-90 transition-opacity rounded-lg py-3 font-medium text-base"
                >
                  {isSwitch ? "Change" : "Train anyway"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {mainView === "home" && (
        <button
          onClick={() => setMainView("leaderboard")}
          className="fixed top-6 right-6 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-400/40 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-amber-500/10 rounded-full py-3 px-5 text-base font-medium shadow-lg"
        >
          🏆 Leaderboard
        </button>
      )}

      {mainView === "home" && (
        <button
          onClick={() => setMainView("achievements")}
          className="fixed top-6 left-6 flex items-center gap-2.5 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 border border-violet-400/40 text-violet-100 transition-all duration-200 hover:scale-105 rounded-full py-3 px-6 text-base font-medium shadow-lg shadow-violet-950/50 hover:shadow-xl hover:shadow-violet-500/30"
        >
          <span className="text-lg">🏅</span>
          <span>Achievements</span>
          <span className="text-xs font-semibold bg-violet-400/25 text-violet-100 rounded-full px-2 py-0.5">
            {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, achievementState)).length}/
            {ACHIEVEMENTS_CATALOG.length}
          </span>
        </button>
      )}

      {mainView === "home" && (
        <button
          onClick={() => setMainView("account")}
          className="fixed bottom-6 right-6 flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-400/40 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/10 rounded-full py-3 px-7 text-base font-medium shadow-lg"
        >
          <AvatarFrame tier={ownAvatarFrameTier}>
            <Avatar avatarId={selectedAvatarId} imageUrl={customAvatarImage} size={24} />
          </AvatarFrame>
          Account
        </button>
      )}

      {mainView === "home" && (
        <button
          onClick={() => {
            setFeedbackSubmitted(false);
            setFeedbackText("");
            setFeedbackOpen(true);
          }}
          className="fixed bottom-6 left-6 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-teal-400/40 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-teal-500/10 rounded-full py-3 px-5 text-base font-medium shadow-lg"
        >
          💬 Feedback
        </button>
      )}

      {feedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-8"
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            className="relative flex flex-col gap-5 w-full max-w-sm bg-slate-900 border border-slate-700/70 rounded-2xl p-7 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            {feedbackSubmitted ? (
              <>
                <div className="text-center space-y-2 py-4">
                  <div className="text-4xl">💌</div>
                  <div className="text-xl font-semibold text-slate-100">Thanks!</div>
                  <div className="text-slate-400 text-base">
                    Your feedback has been sent.
                  </div>
                </div>
                <button
                  onClick={() => setFeedbackOpen(false)}
                  className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-3 font-medium text-lg"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div>
                  <div className="text-xl font-semibold text-slate-100">Send feedback</div>
                </div>
                <textarea
                  autoFocus
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What could be better?"
                  rows={5}
                  maxLength={1000}
                  className="w-full text-base text-slate-100 bg-slate-950 border border-slate-700/70 focus:border-teal-500 focus:outline-none rounded-lg px-4 py-3 resize-none placeholder:text-slate-500"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setFeedbackOpen(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-3 font-medium text-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      submitFeedback(feedbackText);
                      setFeedbackSubmitted(true);
                    }}
                    disabled={!feedbackText.trim()}
                    className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-400 hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 transition-opacity rounded-lg py-3 font-medium text-lg"
                  >
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Catches errors thrown outside React's render (e.g. an async storage
// callback, a THREE.js frame callback, an unhandled promise rejection)
// which componentDidCatch above can't see — those would otherwise fail
// completely silently. Installed once at the app root.
export default function NBackSessionAppWithDiagnostics() {
  useEffect(() => {
    const handleError = (event) => {
      logClientError("window error", event?.error || event?.message);
    };
    const handleRejection = (event) => {
      logClientError("unhandled promise rejection", event?.reason);
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
  return (
    <AppErrorBoundary>
      <AuthGate>
        <NBackSessionApp />
      </AuthGate>
    </AppErrorBoundary>
  );
}

// RRT running screen (draft) — self-contained: its own puzzle generation
// and local state, not yet wired into exerciseHistory/exerciseStats or the
// pass/fail level-adjustment logic that dual/quad use (that comes once the
// scoring model itself is settled).
//
// One 20s clock runs across the whole round (premises + the final
// true/false conclusion) rather than resetting per premise. It's armed by
// the checkbox next to TIMER and doesn't tick until that's checked. If it
// hits 0 with no answer given, that's a miss. Answering the conclusion in
// time flashes green (correct) or red (wrong), then a brand-new set of
// premises loads automatically — no manual "continue" needed. The exercise
// itself ends when the outer regime session timer swaps to the next step
// (same as every other exercise). onFinish is also wired to a "Skip to
// overview" test button on the premises/question screens, for trying out
// the rest of the flow without waiting out the real session timer.
// Reserved height for the RRT card's button footer — sized to fit the
// conclusion screen's two rows (Back, then True/False) plus its gap, and
// applied via inline style (not a Tailwind arbitrary-value class) so it
// isn't at the mercy of whether the CSS build has picked up this class.
// Shared by both the premises and conclusion screens so the card is the
// same height either way and nothing shifts when moving between them.
const RRT_FOOTER_MIN_HEIGHT = 108;

function RRTExercise({ exercise, onFinish, onStageChange, onLevelUp, onSessionEnd, paused, scrambleFactor = 0, branchingEnabled = true }) {
  const accent = ACCENT_STYLES[exercise.accent];
  const [stage, setStage] = useState("setup"); // setup | premises | question
  const [puzzle, setPuzzle] = useState(null);
  const [premiseIndex, setPremiseIndex] = useState(0);

  // Difficulty progression: every 20 correct answers in a row, RRT steps up
  // once. Each premise-count tier has 3 steps — the round length drops 5s
  // twice (30s → 25s → 20s), then the 3rd step adds a premise and resets
  // the round back to 30s (e.g. 2p 30s → 2p 25s → 2p 20s → 3p 30s → …).
  // Starts at 2p, tops out at 10p.
  const [rrtIncrementCount, setRrtIncrementCount] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0); // consecutive wrong/missed — mirrors correctStreak, drives forcing the difficulty back down
  const [downNotice, setDownNotice] = useState(false); // brief "eased back down" banner after a forced decrement
  const downNoticeTimeoutRef = useRef(null);
  const premiseCount = 2 + Math.floor(rrtIncrementCount / 3);
  const ROUND_MS = (30 - (rrtIncrementCount % 3) * 5) * 1000;

  const [msLeft, setMsLeft] = useState(ROUND_MS); // drives both the "N sec" readout and the bar, updated at animation-frame rate for smoothness
  const [timerRunning, setTimerRunning] = useState(false); // gated by the checkbox — paused at the start of every round
  const [flash, setFlash] = useState(null); // null | "correct" | "wrong" | "missed"
  const [tally, setTally] = useState({ correct: 0, wrong: 0, missed: 0 });
  const flashTimeoutRef = useRef(null);
  const missTimeoutRef = useRef(null);
  const rafRef = useRef(null);
  const deadlineRef = useRef(null);

  // Total time spent in this exercise (across every round), for the
  // top-right duration readout. Only advances when a trial (round) actually
  // finishes, by the amount of time its clock was armed and counting down —
  // not on a real-time ticker, so it doesn't creep up while sitting idle
  // between rounds or before the timer checkbox is checked.
  const [elapsedMs, setElapsedMs] = useState(0);

  // Mirrors state needed to save progress on unmount (see the cleanup
  // effect below) — a plain effect cleanup closure only ever sees the
  // values from whenever it was first set up, so these refs are kept in
  // sync on every render instead. sessionSavedRef flags once the normal
  // full-duration save (inside triggerFlash) has already reported this
  // session, so the unmount save below doesn't double-log it.
  const elapsedMsRef = useRef(0);
  const tallyRef = useRef({ correct: 0, wrong: 0, missed: 0 });
  const premiseCountRef = useRef(premiseCount);
  const roundMsRef = useRef(ROUND_MS);
  const rrtIncrementCountRef = useRef(rrtIncrementCount);
  const correctStreakRef = useRef(0);
  const sessionSavedRef = useRef(false);
  elapsedMsRef.current = elapsedMs;
  tallyRef.current = tally;
  premiseCountRef.current = premiseCount;
  roundMsRef.current = ROUND_MS;
  rrtIncrementCountRef.current = rrtIncrementCount;
  correctStreakRef.current = correctStreak;

  // Previously RRT only ever reported a completed session to the parent
  // once the full session-duration cutoff was hit inside triggerFlash —
  // so leaving early (switching exercises, going back to Home) after
  // playing for a while lost that progress entirely, unlike every other
  // exercise. This saves whatever was played so far as soon as the
  // component unmounts, as long as at least one round was answered and
  // the natural cutoff hasn't already saved it.
  useEffect(() => {
    return () => {
      if (sessionSavedRef.current) return;
      const t = tallyRef.current;
      if (t.correct + t.wrong + t.missed === 0) return;
      onSessionEnd?.({
        premiseCount: premiseCountRef.current,
        roundSeconds: roundMsRef.current / 1000,
        levelReached: 1 + Math.floor(rrtIncrementCountRef.current / 3),
        durationMs: elapsedMsRef.current,
        streakReached: correctStreakRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A first pass at a round-by-round history log — every completed round
  // (answered or missed), most recent first, capped so it doesn't grow
  // unbounded across a long session. Local to this component only (not
  // persisted to window.storage or exerciseHistory yet) — good enough for
  // reviewing the current session, can be wired up further later.
  const [roundHistory, setRoundHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  // The item a person tapped inside a history entry — shows an enlarged
  // tile so they can see clearly which color/pattern or letter tag it was,
  // without having to squint at the small inline chip.
  const [historyItemPopup, setHistoryItemPopup] = useState(null);
  // The history entry currently showing its deduction-chain explanation
  // (hover on desktop, tap-to-toggle on touch — see the button below).
  const [explanationFor, setExplanationFor] = useState(null);

  const pushRoundHistory = (userAnswer, correct) => {
    if (!puzzle) return;
    setRoundHistory((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          puzzleType: puzzle.puzzleType,
          items: puzzle.items,
          premises: puzzle.premises,
          conclusion: puzzle.conclusion,
          userAnswer, // true | false | null (missed — never answered)
          correct,
          responseTimeMs: Math.max(0, ROUND_MS - msLeft),
          ts: Date.now(),
        },
        ...prev,
      ].slice(0, 50)
    );
  };


  // Let the parent know whether we're still on the setup screen or actually
  // in the exercise — it hides "← Home" and the "Exercise X of Y" label once
  // we've moved past setup, same as every other exercise.
  useEffect(() => {
    onStageChange?.(stage);
  }, [stage, onStageChange]);

  useEffect(
    () => () => {
      clearTimeout(flashTimeoutRef.current);
      clearTimeout(missTimeoutRef.current);
      clearTimeout(downNoticeTimeoutRef.current);
      cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const beginRound = useCallback(
    (keepTimerRunning = false, override) => {
      const pc = override?.premiseCount ?? premiseCount;
      const rm = override?.roundMs ?? ROUND_MS;
      // At 0% scramble, "every premise links to the very next one" only
      // holds if the underlying item graph is a straight chain — a
      // branching tree can put two premises back-to-back that don't
      // actually share an item, no matter how they're ordered on screen.
      // So 0% forces a linear chain regardless of the separate branching
      // toggle; branching only applies once there's some scramble to
      // combine it with.
      const useBranching = scrambleFactor > 0 && branchingEnabled;
      const newPuzzle = generateRrtPuzzle(pc, useBranching);
      newPuzzle.premiseOrder = scramblePremiseOrder(newPuzzle.premises, scrambleFactor);
      setPuzzle(newPuzzle);
      setPremiseIndex(0);
      setMsLeft(rm);
      setTimerRunning(keepTimerRunning);
      setFlash(null);
      setStage("premises");
    },
    [premiseCount, ROUND_MS, scrambleFactor, branchingEnabled]
  );

  // triggerFlash schedules beginRound 800ms out via setTimeout — by the
  // time that fires, an increment may have already bumped premiseCount/
  // ROUND_MS in a re-render, but the setTimeout closure would otherwise
  // still be holding onto the *old* beginRound from when triggerFlash was
  // called (same tick as the increment), starting the next round on the
  // stale settings instead of the one they just leveled into. Always
  // calling through this ref instead guarantees whichever beginRound is
  // newest at the moment the timeout actually fires is the one used — and
  // triggerFlash's own `override` param (see answer() above) guarantees it
  // even when the increment hasn't been reflected in state/re-render yet.
  const beginRoundRef = useRef(beginRound);
  useEffect(() => {
    beginRoundRef.current = beginRound;
  }, [beginRound]);

  // Captures whether the checkbox was already ticked at the moment the
  // round ends, so the next set of premises keeps it ticked instead of
  // making the person re-check it every round. Also credits this round's
  // actual clock-running time (ROUND_MS - whatever was left when it ended)
  // to the total duration — 0 if the timer was never armed for the round.
  const triggerFlash = (kind, override) => {
    const keepTimerRunning = timerRunning;
    const totalElapsedMs = elapsedMs + Math.max(0, ROUND_MS - msLeft);
    setElapsedMs(totalElapsedMs);
    setFlash(kind);
    clearTimeout(flashTimeoutRef.current);

    // Session-duration cutoff — mirrors Motion3DExercise's sessionBudgetMs
    // check. Without this, RRT never actually ended on its own (nothing in
    // this component ever called onFinish based on elapsed time), and never
    // reported a completed session to the parent either — see
    // recordRrtSessionEnd's comment for what that broke. Guarded on at
    // least one round having been answered so an essentially-empty visit
    // (checked the box, immediately backed out) doesn't log a session.
    const sessionBudgetMs = exercise.sessionDurationMs || 15 * 60 * 1000;
    if (totalElapsedMs >= sessionBudgetMs) {
      flashTimeoutRef.current = setTimeout(() => {
        if (tallyRef.current.correct + tallyRef.current.wrong + tallyRef.current.missed > 0) {
          sessionSavedRef.current = true;
          onSessionEnd?.({
            premiseCount,
            roundSeconds: ROUND_MS / 1000,
            levelReached: 1 + Math.floor(rrtIncrementCount / 3), // matches recordRrtLevelUp's bestN convention
            durationMs: totalElapsedMs,
            streakReached: correctStreakRef.current,
          });
        }
        onFinish?.();
      }, 800);
      return;
    }

    flashTimeoutRef.current = setTimeout(
      () => beginRoundRef.current(keepTimerRunning, override),
      800
    );
  };

  // Countdown — animation-frame driven (not 1-per-second steps) so the bar
  // glides smoothly instead of jumping once a second. Pauses while
  // unarmed, mid-flash, once it's hit zero, or while `paused` is set (a
  // level-up/achievement celebration is covering the screen — see the
  // `paused` prop). Without that last check, the clock kept ticking away
  // underneath those full-screen celebrations, invisible to the person
  // looking at them, so a round could silently time out (or even cycle
  // through several) before they ever got to see it — this way the
  // deadline is only computed fresh once the screen is actually clear
  // again, so no hidden time is ever lost.
  useEffect(() => {
    if (!timerRunning || flash || paused) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    deadlineRef.current = Date.now() + msLeft;
    const tick = () => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      setMsLeft(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, flash, paused]);

  // Time's up with nothing answered — briefly hold on 0 sec so it visibly
  // reads "0" before the miss flash covers it, then a fresh set loads.
  useEffect(() => {
    if (timerRunning && !paused && msLeft <= 0 && !flash && (stage === "premises" || stage === "question")) {
      missTimeoutRef.current = setTimeout(() => {
        setTally((t) => ({ ...t, missed: t.missed + 1 }));
        pushRoundHistory(null, false);
        setCorrectStreak(0);
        const nextWrong = wrongStreak + 1;
        let override = null;
        if (nextWrong >= 3) {
          override = triggerRrtDecrement();
          setWrongStreak(0);
        } else {
          setWrongStreak(nextWrong);
        }
        triggerFlash("missed", override);
      }, 500);
      return () => clearTimeout(missTimeoutRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, timerRunning, stage, flash, paused]);

  // Pulled out of answer() below so the 🧪 test button can trigger the same
  // "20 in a row" step-up without actually needing 20 correct answers.
  // Returns the new { premiseCount, roundMs } so the caller can pass them
  // straight through to the round that's about to begin, rather than
  // relying on beginRound reading them back off component state — that
  // state update isn't guaranteed to have landed yet by the time this
  // returns (see answer() below).
  const triggerRrtIncrement = () => {
    const newCount = rrtIncrementCount + 1;
    setRrtIncrementCount(newCount);
    const newPremiseCount = 2 + Math.floor(newCount / 3);
    const newRoundMs = (30 - (newCount % 3) * 5) * 1000;
    const level = newPremiseCount - 1; // 2p → 1, 3p → 2, 4p → 3, … just feeds the gem tier/color
    onLevelUp?.(level, `RRT ${newPremiseCount}p ${newRoundMs / 1000}s`);
    return { premiseCount: newPremiseCount, roundMs: newRoundMs };
  };

  // The other direction — 3 wrong/missed answers in a row (see wrongStreak
  // in answer() and the miss-timeout effect below) forces the difficulty
  // back down by exactly one step, same granularity as an increment (round
  // length first, then premise count once it wraps). No-ops at the very
  // bottom (2p/30s, rrtIncrementCount 0) since there's nowhere further down
  // to go. Shows a brief inline banner rather than the shared full-screen
  // level-up modal — a step DOWN isn't something to interrupt the person to
  // celebrate.
  const triggerRrtDecrement = () => {
    if (rrtIncrementCount <= 0) return null;
    const newCount = rrtIncrementCount - 1;
    setRrtIncrementCount(newCount);
    const newPremiseCount = 2 + Math.floor(newCount / 3);
    const newRoundMs = (30 - (newCount % 3) * 5) * 1000;
    setDownNotice(true);
    clearTimeout(downNoticeTimeoutRef.current);
    downNoticeTimeoutRef.current = setTimeout(() => setDownNotice(false), 3000);
    return { premiseCount: newPremiseCount, roundMs: newRoundMs };
  };

  const answer = (value) => {
    if (flash) return;
    const correct = puzzle.conclusion.answer === value;
    pushRoundHistory(value, correct);
    setTally((t) => ({
      ...t,
      correct: t.correct + (correct ? 1 : 0),
      wrong: t.wrong + (correct ? 0 : 1),
    }));
    // Deliberately NOT using setCorrectStreak's functional-updater form to
    // decide this — that updater doesn't actually run until React
    // processes the queued state update (after this whole handler
    // returns), so triggerRrtIncrement()'s result wouldn't be available
    // yet down at the triggerFlash() call below. Reading correctStreak
    // straight from this render's closure instead is safe here since
    // nothing else touches it earlier in this same handler. Same reasoning
    // applies to wrongStreak below.
    let override = null;
    if (correct) {
      setWrongStreak(0);
      const next = correctStreak + 1;
      // 20 correct in a row steps up the difficulty once and resets the
      // streak counter — see rrtIncrementCount above for what each step
      // actually changes (round length, then eventually premise count).
      // Fires the same shared level-up celebration every other exercise
      // uses, every time this happens — not just the first time RRT ever
      // reaches a given tier.
      if (next >= 20) {
        override = triggerRrtIncrement();
        setCorrectStreak(0);
      } else {
        setCorrectStreak(next);
      }
    } else {
      setCorrectStreak(0);
      const nextWrong = wrongStreak + 1;
      // 3 wrong in a row forces the difficulty back down one step — the
      // mirror of the 20-correct step-up above, just at a much shorter
      // fuse (matching how dual/quad drop after 3 bad sessions in a row).
      if (nextWrong >= 3) {
        override = triggerRrtDecrement();
        setWrongStreak(0);
      } else {
        setWrongStreak(nextWrong);
      }
    }
    triggerFlash(correct ? "correct" : "wrong", override);
  };

  const secondsLeft = Math.ceil(msLeft / 1000);

  if (stage === "setup") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{exercise.title}</h1>
          <p className="text-slate-500 text-lg mt-2">Space 2D · Variation 1</p>
        </div>

        <div className={`${accent.bg} border ${accent.border} rounded-xl p-6 space-y-3`}>
          <div className="text-lg text-slate-300">
            Premises: <span className="text-slate-100 font-medium">{premiseCount}p</span>
          </div>
          <div className="text-lg text-slate-400">
            Round length: <span className="text-slate-200 font-medium">{ROUND_MS / 1000} sec</span>
          </div>
          <p className="text-slate-400 text-base">
            A chain of statements about a set of items, then one true/false
            question at the end. Each round is randomly "same as" /
            "opposite of", "contains" / "is within", or "more than" /
            "less than". Check the timer box when you're ready to start the
            clock.
          </p>
        </div>

        <button
          onClick={() => beginRound(false)}
          className={`w-full bg-gradient-to-r ${accent.grad} hover:opacity-90 transition-opacity rounded-lg py-4 font-medium text-xl shadow-lg shadow-black/30`}
        >
          Start
        </button>
      </div>
    );
  }

  // Shared header for both "premises" and "question" — one continuous clock,
  // armed by the checkbox, plus the running duration readout.
  const timerHeader = (
    <>
      {downNotice && (
        <div className="text-sm rounded-lg px-4 py-2 border text-amber-400 bg-amber-950/40 border-amber-800">
          Eased back to {premiseCount}p / {ROUND_MS / 1000}s after a few misses in a row.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-base text-slate-400 font-medium">
          <span>{correctStreak}/20 in a row</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-base text-slate-400 font-medium">
            {formatDuration(elapsedMs)}
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="text-sm text-slate-400 hover:text-slate-200 underline decoration-dotted underline-offset-2 transition-colors"
          >
            History
          </button>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-300"
          style={{ width: `${(msLeft / ROUND_MS) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="italic font-bold tracking-wide text-slate-300 text-lg">TIMER</div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-base font-medium">
            {secondsLeft} sec
          </div>
          <button
            onClick={() => {
              if (timerRunning) {
                setTimerRunning(false); // just pause — keep the current puzzle
              } else {
                // Arming the timer always starts on a completely fresh
                // puzzle, discarding whatever's on screen right now — closes
                // the "pause, read the premises untimed, then check the box
                // and answer instantly" loophole. Nothing seen while paused
                // survives into the timed round.
                beginRound(true);
              }
            }}
            disabled={msLeft === 0 || !!flash}
            role="checkbox"
            aria-checked={timerRunning}
            title={timerRunning ? "Pause the timer" : "Start the timer on a fresh set"}
            className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors disabled:opacity-40 ${
              timerRunning
                ? `${accent.border} ${accent.bg}`
                : "border-slate-500 bg-slate-900 hover:border-slate-300"
            }`}
          >
            {timerRunning && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={accent.text}
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-start justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl">
              <div className="italic font-bold tracking-wide text-slate-300 text-lg">HISTORY</div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-2xl leading-none px-2"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              {roundHistory.length === 0 ? (
                <div className="text-slate-500 text-base text-center py-8">
                  No completed rounds yet this session.
                </div>
              ) : (
                roundHistory.map((entry, i) => {
                  const missed = entry.userAnswer === null;
                  return (
                  <div
                    key={entry.id}
                    className={`rounded-xl border p-4 space-y-3 ${
                      missed
                        ? "border-slate-700 bg-black/40"
                        : entry.correct
                        ? "border-green-700 bg-green-950/20"
                        : "border-red-600 bg-red-950/30"
                    }`}
                  >
                    <div className="flex items-center justify-between text-base">
                      <span className="text-slate-400 font-medium">
                        Round {roundHistory.length - i}
                      </span>
                      <span
                        className={
                          missed
                            ? "text-slate-400 font-bold"
                            : entry.correct
                            ? "text-green-400 font-bold"
                            : "text-red-500 font-bold"
                        }
                      >
                        {missed ? "MISSED" : entry.correct ? "CORRECT" : "WRONG"}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-base text-slate-200">
                      <div className="text-slate-400 uppercase text-sm tracking-wide font-semibold">
                        Premises
                      </div>
                      {entry.premises.map((p, pi) => (
                        <div key={pi} className="flex items-center gap-2 flex-wrap">
                          <RrtHistoryItemChip item={p.subject} onClick={setHistoryItemPopup} />
                          <span className="font-medium">{rrtRelationPhrase(p.relation)}</span>
                          <RrtHistoryItemChip item={p.object} onClick={setHistoryItemPopup} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5 text-base text-slate-200 pt-2 border-t border-slate-800">
                      <div className="text-slate-400 uppercase text-sm tracking-wide font-semibold">
                        Conclusion
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <RrtHistoryItemChip item={entry.conclusion.subject} onClick={setHistoryItemPopup} />
                        <span className="font-medium">{rrtRelationPhrase(entry.conclusion.relation)}</span>
                        <RrtHistoryItemChip item={entry.conclusion.object} onClick={setHistoryItemPopup} />
                        <span className="font-medium">?</span>
                      </div>
                    </div>
                    <div className="text-base font-bold pt-1 space-y-0.5">
                      <div>
                        User Answer:{" "}
                        <span
                          className={
                            missed
                              ? "text-slate-400"
                              : entry.userAnswer
                              ? "text-green-400"
                              : "text-red-500"
                          }
                        >
                          {missed ? "(TIMED OUT)" : entry.userAnswer ? "TRUE" : "FALSE"}
                        </span>
                      </div>
                      <div>
                        Right Answer:{" "}
                        <span
                          className={
                            entry.conclusion.answer ? "text-green-400" : "text-red-500"
                          }
                        >
                          {entry.conclusion.answer ? "TRUE" : "FALSE"}
                        </span>
                      </div>
                      <div className="text-slate-200">
                        Response Time: {(entry.responseTimeMs / 1000).toFixed(1)} sec
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-600 text-sm">
                        {RRT_PUZZLE_TYPE_LABEL[entry.puzzleType] || "Distinction"}
                      </span>
                      <button
                        // Click-only, no hover handlers — on touch devices
                        // a tap fires a synthetic mouseenter immediately
                        // followed by a synthetic mouseleave (there's no
                        // real hover state to hold), so a mouseleave
                        // handler here was closing the panel a moment
                        // after it opened. Plain click-toggle avoids that
                        // entirely and works the same on desktop.
                        onClick={() =>
                          setExplanationFor((cur) => (cur === entry ? null : entry))
                        }
                        className="bg-teal-700 hover:bg-teal-600 transition-colors rounded-lg px-4 py-1.5 text-sm font-medium"
                      >
                        Explanation
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {explanationFor && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setExplanationFor(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-7 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const explanation = buildRrtExplanationChain(explanationFor);
              const orderConfig = RRT_ORDER_CONFIGS[explanation.puzzleType];
              if (orderConfig) {
                const isVertical = explanation.puzzleType === "vertical";
                return (
                  <div
                    className={
                      isVertical
                        ? "flex flex-col items-center gap-4"
                        : "flex items-center justify-center gap-4"
                    }
                  >
                    {explanation.chainItems.map((it, idx) => (
                      <div
                        key={idx}
                        className={!isVertical && idx > 0 ? "pl-4 border-l border-slate-700" : ""}
                      >
                        {it.type === "voronoi" ? (
                          <RrtItemTile item={it} size={56} />
                        ) : (
                          <div className="text-slate-100 font-bold text-lg tracking-wide">
                            {it.letters}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
              const { groups } = explanation;
              return (
                <div className="flex items-stretch justify-center gap-6">
                  {groups.map((group, gi) => (
                    <div
                      key={gi}
                      className={`flex flex-col items-center gap-3 px-4 ${
                        gi > 0 ? "border-l border-slate-700" : ""
                      }`}
                    >
                      {group
                        .filter((it) => it.type === "voronoi")
                        .map((it, idx) => (
                          <RrtItemTile key={idx} item={it} size={64} />
                        ))}
                      {group
                        .filter((it) => it.type === "letters")
                        .map((it, idx) => (
                          <div
                            key={idx}
                            className="text-slate-100 font-bold text-lg tracking-wide"
                          >
                            {it.letters}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              );
            })()}
            <button
              onClick={() => setExplanationFor(null)}
              className="mt-5 text-base text-slate-400 hover:text-slate-200 underline decoration-dotted underline-offset-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {historyItemPopup && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setHistoryItemPopup(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <RrtItemTile item={historyItemPopup} size={96} />
            {historyItemPopup.type === "voronoi" && (
              <div className="text-slate-300 text-base font-medium">
                {historyItemPopup.colorName} Voronoi
              </div>
            )}
            {historyItemPopup.type === "letters" && (
              <div className="text-slate-300 text-base font-medium">
                {historyItemPopup.letters}
              </div>
            )}
            <button
              onClick={() => setHistoryItemPopup(null)}
              className="text-sm text-slate-400 hover:text-slate-200 underline decoration-dotted underline-offset-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );

  const flashOverlay = flash && (
    <div
      className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 z-10 ${
        flash === "correct"
          ? "bg-emerald-500/90"
          : flash === "wrong"
          ? "bg-rose-500/90"
          : "bg-amber-500/90"
      }`}
    >
      <div className="text-5xl">
        {flash === "correct" ? "✅" : flash === "wrong" ? "❌" : "⏱"}
      </div>
      <div className="text-2xl font-semibold text-white">
        {flash === "correct" ? "Correct!" : flash === "wrong" ? "Wrong" : "Missed"}
      </div>
    </div>
  );

  if (stage === "premises") {
    const premise = puzzle.premises[puzzle.premiseOrder[premiseIndex]];
    const isFirst = premiseIndex === 0;
    const isLast = premiseIndex === puzzle.premises.length - 1;
    return (
      <div className="relative max-w-xs mx-auto">
        {flashOverlay}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl shadow-black/40 overflow-hidden">
          <div className="p-4 flex flex-col">
            <div className="space-y-2.5">
              {timerHeader}

              <div className="flex items-center justify-between">
                <div className="italic font-bold tracking-wide text-slate-300 text-lg">
                  PREMISE
                </div>
                <div className="text-slate-200 text-xl font-semibold">
                  {premiseIndex + 1} / {puzzle.premises.length}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2.5 py-1.5 px-1 flex-wrap text-center">
                <RrtItemTile item={premise.subject} size={32} />
                <span className="text-slate-100 text-lg font-medium">
                  {rrtRelationPhrase(premise.relation)}
                </span>
                <RrtItemTile item={premise.object} size={32} />
              </div>
            </div>

            <div
              className="flex flex-col justify-start gap-3 mt-1.5"
              style={{ minHeight: RRT_FOOTER_MIN_HEIGHT }}
            >
              <div className="flex gap-2.5">
                <button
                  onClick={() => setPremiseIndex((i) => Math.max(0, i - 1))}
                  disabled={isFirst}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 transition-colors rounded-lg py-2 text-base font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (isLast) {
                      setStage("question");
                    } else {
                      setPremiseIndex((i) => i + 1);
                    }
                  }}
                  disabled={!timerRunning}
                  title={!timerRunning ? "Start the timer first" : undefined}
                  className="flex-1 bg-teal-700 hover:bg-teal-600 disabled:opacity-40 disabled:hover:bg-teal-700 transition-colors rounded-lg py-2 text-base font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              setCorrectStreak(0);
              // Threads the new {premiseCount, roundMs} through to an
              // actual fresh round via triggerFlash — same as a real 20th
              // correct answer does. Just calling triggerRrtIncrement()
              // alone bumped the stats/level and showed the celebration,
              // but left the CURRENT round exactly as it was, since nothing
              // told it to regenerate — so the premise count/timer only
              // ever looked "leveled up" once something else (the round
              // ending normally, or manually toggling the timer checkbox,
              // which reads fresh state) happened to regenerate the puzzle.
              const override = triggerRrtIncrement();
              triggerFlash("correct", override);
            }}
            className="flex-1 border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 text-sm"
          >
            🧪 20 in a row
          </button>
          <button
            onClick={onFinish}
            className="flex-1 border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 text-sm"
          >
            🧪 Skip to overview
          </button>
        </div>
      </div>
    );
  }

  // stage === "question"
  const { conclusion } = puzzle;
  return (
    <div className="relative max-w-xs mx-auto">
      {flashOverlay}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl shadow-black/40 overflow-hidden">
        <div className="p-4 flex flex-col">
          <div className="space-y-2.5">
            {timerHeader}

            <div className="text-center">
              <div className={`italic font-bold tracking-wide text-lg ${accent.text}`}>
                CONCLUSION
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 py-1.5 px-1 flex-wrap text-center">
              <RrtItemTile item={conclusion.subject} size={32} />
              <span className="text-slate-100 text-lg font-medium">
                {rrtRelationPhrase(conclusion.relation)}
              </span>
              <RrtItemTile item={conclusion.object} size={32} />
              <span className="text-slate-100 text-lg font-medium">?</span>
            </div>
          </div>

          <div
            className="flex flex-col justify-start gap-3 mt-1.5"
            style={{ minHeight: RRT_FOOTER_MIN_HEIGHT }}
          >
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setPremiseIndex(puzzle.premises.length - 1);
                  setStage("premises");
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 transition-colors rounded-lg py-2 text-base font-medium"
              >
                Back
              </button>
              <button
                disabled
                className="flex-1 bg-slate-800 opacity-40 rounded-lg py-2 text-base font-medium cursor-default"
              >
                Next
              </button>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => answer(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-lg py-2 text-base font-medium"
              >
                True
              </button>
              <button
                onClick={() => answer(false)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 transition-colors rounded-lg py-2 text-base font-medium"
              >
                False
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => {
            setCorrectStreak(0);
            // Same fix as the premises-screen version of this button — see
            // that comment for why the plain triggerRrtIncrement() call
            // alone wasn't enough to actually refresh the round on screen.
            const override = triggerRrtIncrement();
            triggerFlash("correct", override);
          }}
          className="flex-1 border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 text-sm"
        >
          🧪 20 in a row
        </button>
        <button
          onClick={onFinish}
          className="flex-1 border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 text-sm"
        >
          🧪 Skip to overview
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 3D Motion — Multiple Object Tracking (MOT)
// ---------------------------------------------------------------------
// Classic MOT paradigm: 10 balls drift inside a bounded 3D volume. 5 flash
// gold for a few seconds as the targets, then every ball turns the same
// neutral color and the whole set drifts/bounces for a while. Balls freeze,
// and the person clicks the 5 they believe were targets. Ball speed is on a
// staircase — a perfect round (all 5 targets, no wrong picks) speeds things
// up next round, anything less slows it back down — same "ease down after
// misses" spirit as RRT, just continuous instead of streak-gated.
const MOT_BALL_COUNT = 10;
const MOT_TARGET_COUNT = 5;
const MOT_CUBE_HALF = 3.2; // half-extent of the bounding cube along each axis
const MOT_BALL_RADIUS = 0.34;
const MOT_HIGHLIGHT_MS = 1800; // how long targets flash gold before blending in
const MOT_TRACK_MS = 8000; // how long balls drift before freezing for selection
// Range recalibrated so ~0.50 sits near the top of what's manageable for
// most people (previously the max was 5, which made 0.5 barely above the
// floor — per actual play, 0.5 is already pushing what most people can
// track) — but the ceiling itself goes further, to 1.00, so the staircase
// (and the manual +/- Speed buttons) still have real headroom above that
// for anyone who can actually keep up; 1.00 is genuinely very fast, not
// meant to be where most people land.
const MOT_MIN_SPEED = 0.15;
const MOT_MAX_SPEED = 1.0;
const MOT_START_SPEED = 0.25;
const MOT_SPEED_STEP = 0.01; // flat per-round adjustment — up on a perfect round, down otherwise
// The staircase/UI speed value (0.15–1.00 above) isn't applied to the
// balls directly as their actual velocity — it's remapped through this
// curve first. Below the breakpoint the curve is anchored at
// MOT_START_SPEED (so the very first round's actual ball speed is
// unchanged) and then ramps away from that anchor at
// MOT_SPEED_CURVE_LOW_MULT× the plain 1:1 rate — a single +0.01 staircase
// step used to move velocity by a barely-perceptible amount; this makes
// each step read as a clearly noticeable jump instead. Above the
// breakpoint it steepens further still, per the original playtesting
// calibration (0.50 already reads as noticeably harder than 0.15, and
// 1.00 harder still) — the whole thing is then scaled up 4x across every
// speed, not just the top end, since even the steepened top end still
// felt too slow overall.
const MOT_SPEED_CURVE_BREAKPOINT = 0.5;
const MOT_SPEED_CURVE_LOW_MULT = 1.8; // how much steeper than 1:1 each 0.01 step below the breakpoint feels
const MOT_SPEED_CURVE_STEEPNESS = 3; // multiplier applied to the portion above the breakpoint
const MOT_SPEED_CURVE_SCALE = 4; // uniform multiplier — 4x every speed, not just high ones (2x wasn't enough)
function motDisplaySpeedToVelocity(displaySpeed) {
  const shapedAtBreakpoint =
    MOT_START_SPEED + (MOT_SPEED_CURVE_BREAKPOINT - MOT_START_SPEED) * MOT_SPEED_CURVE_LOW_MULT;
  const shaped =
    displaySpeed <= MOT_SPEED_CURVE_BREAKPOINT
      ? MOT_START_SPEED + (displaySpeed - MOT_START_SPEED) * MOT_SPEED_CURVE_LOW_MULT
      : shapedAtBreakpoint + (displaySpeed - MOT_SPEED_CURVE_BREAKPOINT) * MOT_SPEED_CURVE_STEEPNESS;
  return shaped * MOT_SPEED_CURVE_SCALE;
}
// Tier size for the level-up celebration — with the whole range now under
// 1.0, tiers can't be whole-number crossings of `speed` anymore (that
// never would have fired), so tiers are steps of this size instead. At
// 0.10, the full MOT_MIN_SPEED-MOT_MAX_SPEED range (0.15-1.0) spans
// exactly the 10 gem tiers (GEM_TIERS 1-10) evenly.
const MOT_TIER_STEP = 0.1;
// Bump this whenever MOT_MIN_SPEED/MOT_MAX_SPEED/MOT_TIER_STEP change in a
// way that shifts what tier a given speed maps to. A persisted bestN from
// before the bump was computed against a different scale — reading it
// against the new one is how a fresh app open ends up showing 3D Motion
// achievements as already unlocked with no session having earned them
// under the current scale. See the hydration effect below, which resets
// exerciseStats.motion3d instead of trusting it when this doesn't match.
const MOT_TIER_SCHEMA_VERSION = 2;
const MOT_COLOR_NEUTRAL = 0xaba89f; // light grey, matches the reference ball color (slightly darkened)
const MOT_COLOR_TARGET = 0xb4a55a; // muted gold — desaturated to match the neutral ball's sophistication
const MOT_COLOR_CORRECT = 0x5a8269; // muted sage green — same idea: low saturation reads as premium, high saturation reads as a toy
const MOT_COLOR_WRONG = 0x965f5a; // muted brick red — same idea
const MOT_COLOR_MISSED = 0xb4a55a; // same muted gold as MOT_COLOR_TARGET — never shown at the same time, so sharing a color is fine

// Uniform-random unit vector (so starting directions don't bunch up near
// the poles the way naive spherical-coordinate sampling would) — still
// used for each ball's initial travel direction.
function motRandomUnitVector() {
  const z = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), z);
}

// Random point inside the cube, inset by `margin` on every axis (so a ball
// spawned here doesn't already need to be resolved out of the wall).
function motRandomPointInCube(margin) {
  const span = MOT_CUBE_HALF - margin;
  return new THREE.Vector3(
    (Math.random() * 2 - 1) * span,
    (Math.random() * 2 - 1) * span,
    (Math.random() * 2 - 1) * span
  );
}

// Builds a proper latitude/longitude "wireframe globe" pattern out of real
// great-circle line loops — a handful of longitude circles (through the
// poles, spaced by rotation around Y) plus a few latitude rings (horizontal,
// at various heights). An EdgesGeometry taken from a low-poly sphere was
// tried first, but that outlines every single triangle edge, which reads as
// scattered little tick marks rather than continuous lines. This is called
// once and the returned template group is cloned per ball — clones share
// the same underlying line geometries/material (Object3D.clone() copies by
// reference), so the per-ball cost is just a handful of small Line objects.
function buildBallLineTemplate(radius, color) {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 });
  const segments = 40;

  const numLongitude = 3;
  for (let i = 0; i < numLongitude; i++) {
    const points = [];
    for (let s = 0; s <= segments; s++) {
      const t = (s / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.sin(t) * radius, Math.cos(t) * radius, 0));
    }
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), mat);
    line.rotation.y = (i / numLongitude) * Math.PI;
    group.add(line);
  }

  const latitudes = [-0.5, 0.5]; // radians from the equator — no separate equator line, just the two bands
  latitudes.forEach((lat) => {
    const y = Math.sin(lat) * radius;
    const r = Math.cos(lat) * radius;
    const points = [];
    for (let s = 0; s <= segments; s++) {
      const t = (s / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
    }
    group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), mat));
  });

  return group;
}

// Real adaptive canvas size — genuinely uses whatever width AND height are
// actually free on screen. Width comes from the host container. Height is
// computed from the ACTUAL measured position of the canvas on the page
// (window.innerHeight minus wherever the canvas's top edge really landed —
// without needing to hardcode or guess that figure) minus a hairline
// reserved margin at the bottom. There's no separate setup screen anymore
// (see Motion3DExercise below — it starts the first round itself on
// mount), so this no longer needs a stage-dependent reserved amount; the
// canvas is always effectively the entire card, edge to edge.
const MOT_RESERVED_BELOW_CANVAS = 16;
const MOT_MIN_CANVAS_DIM = 220;
function computeMotionCanvasSize(hostWidth, hostTop) {
  const w = Math.max(MOT_MIN_CANVAS_DIM, Math.round(hostWidth || MOT_MIN_CANVAS_DIM));
  const h = Math.max(MOT_MIN_CANVAS_DIM, Math.round(window.innerHeight - hostTop - MOT_RESERVED_BELOW_CANVAS));
  return { w, h };
}

// Home-row keys (plus "i", the natural 10th neighbor) — one letter per
// ball, so picking a target is a single keypress without needing to look
// down at the keyboard. Shuffled once per mount (see the ball-creation
// loop below) and kept stable for the whole session; it's just a fixed
// label identifying which ball is which; it doesn't need to change round
// to round for the mechanic to work.
const MOT_KEY_LETTERS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", "i"];

// Projects a ball's live 3D position to 2D canvas-pixel coordinates, for
// positioning its letter label — the label is a real DOM element (crisp
// at any zoom, unaffected by the ball's own rotation) rather than baked
// into the 3D texture.
function motProjectToScreen(position, camera, width, height) {
  const v = position.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
    behindCamera: v.z > 1,
  };
}

function Motion3DExercise({ exercise, onFinish, onStageChange, onLevelUp, onSessionEnd, onResetProgress, paused }) {
  const accent = ACCENT_STYLES[exercise.accent];
  const [stage, setStage] = useState("setup"); // setup | highlight | track | select | result
  const [speed, setSpeed] = useState(MOT_START_SPEED);
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });
  const [roundResult, setRoundResult] = useState(null); // { correctCount, wrongCount, allCorrect }
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 320 }); // real adaptive pixel size — see computeMotionCanvasSize below

  const canvasHostRef = useRef(null);
  const canvasMountRef = useRef(null); // dedicated child div that ONLY ever holds the three.js canvas — see the mount effect below for why this can't just be canvasHostRef itself
  const sceneRef = useRef(null); // { scene, camera, renderer, balls, raycaster, mouse, clock, angle, animFrame }
  const labelRefs = useRef([]); // one DOM node per ball's letter label — positioned imperatively every frame (see animate()) rather than through React state, since that would mean a re-render on every frame just to move text
  const [ballLetters, setBallLetters] = useState([]); // set once when the scene creates its balls — just for the label text, not position
  const stageRef = useRef(stage);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  const stageTimeoutRef = useRef(null);
  const roundStartRef = useRef(null); // Date.now() when the CURRENT round began — reset every startRound() call, including restarts, so idle/skipped time never gets credited
  const trainedMsRef = useRef(0); // cumulative real duration of rounds that were actually answered — only submitSelection adds to this, so hitting Restart mid-round (or letting the app sit idle) can't pad the timer
  const tallyRef = useRef({ correct: 0, wrong: 0 }); // mirrors `tally`, but read synchronously — lets the finish path report this session's final correct/wrong count without waiting on a state update to land
  const onResizeRef = useRef(null); // lets the resize handler defined inside the scene-setup effect be re-invoked (e.g. on an actual window resize) from outside that effect's closure

  useEffect(() => {
    stageRef.current = stage;
    onStageChange?.(stage);
  }, [stage, onStageChange]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // One-time three.js scene setup — the scene/renderer/balls live for the
  // whole component lifetime; rounds just reset positions/colors on them
  // rather than tearing anything down between rounds.
  useEffect(() => {
    const host = canvasHostRef.current;
    const mount = canvasMountRef.current;
    if (!host || !mount) return;

    const { w: width, h: height } = computeMotionCanvasSize(
      host.clientWidth,
      host.getBoundingClientRect().top
    );
    setCanvasSize({ w: width, h: height });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Real-time shadows are the biggest single fix for "two balls near the
    // same line of sight read as a flat overlap instead of one floating in
    // front of the other" — without them there's nothing on the balls
    // themselves to show which one is actually closer to the camera beyond
    // the silhouette edge, which is easy to misread. With shadows on, a
    // ball passing near/in front of another visibly casts a shadow onto
    // it, which is a much stronger depth cue than occlusion alone.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Clearing and appending against `mount` (a div that exists solely to
    // hold the canvas) instead of `host` — `host` also has the stage
    // label, restart button, and dev controls rendered into it by React,
    // and clearing its innerHTML here was deleting those real DOM nodes
    // out from under React right after mount, which is why the restart
    // button (and everything else overlaid on the scene) never actually
    // showed up.
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.34);
    dirLight.position.set(4, 6, 8);
    dirLight.castShadow = true;
    // Shadow camera frustum sized to just cover the cube the balls move
    // in — tight enough for crisp shadows, loose enough that a ball near
    // any wall still casts/receives correctly.
    const shadowExtent = MOT_CUBE_HALF * 1.6;
    dirLight.shadow.camera.left = -shadowExtent;
    dirLight.shadow.camera.right = shadowExtent;
    dirLight.shadow.camera.top = shadowExtent;
    dirLight.shadow.camera.bottom = -shadowExtent;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.bias = -0.0015;
    scene.add(dirLight);
    // Dim fill light from the opposite side so the shadowed half of each
    // ball doesn't go flat black — keeps the shape readable while still
    // leaving a clear bright/dark side for depth and roundness.
    const fillLight = new THREE.DirectionalLight(0xaecbff, 0.5);
    fillLight.position.set(-5, -2, -6);
    scene.add(fillLight);

    const boundaryGeo = new THREE.BoxGeometry(
      MOT_CUBE_HALF * 2,
      MOT_CUBE_HALF * 2,
      MOT_CUBE_HALF * 2
    );
    // EdgesGeometry + LineSegments draws only the 12 real cube edges — a
    // plain wireframe material on the box mesh would also draw the
    // diagonal split of each face's two triangles, which reads as stray
    // lines slicing across the cube.
    const boundaryEdges = new THREE.EdgesGeometry(boundaryGeo);
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.55,
    });
    const boundary = new THREE.LineSegments(boundaryEdges, boundaryMat);
    scene.add(boundary);

    const ballGeo = new THREE.SphereGeometry(MOT_BALL_RADIUS, 24, 18);
    // Template for the latitude/longitude line overlay — cloned per ball
    // below (see buildBallLineTemplate for why this replaced an
    // EdgesGeometry-based approach).
    const ballLineTemplate = buildBallLineTemplate(MOT_BALL_RADIUS * 1.012, 0x4a4742);
    const letters = [...MOT_KEY_LETTERS];
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    setBallLetters(letters);
    const balls = [];
    for (let i = 0; i < MOT_BALL_COUNT; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: MOT_COLOR_NEUTRAL,
        roughness: 0.32,
        metalness: 0.18,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15,
      });
      const mesh = new THREE.Mesh(ballGeo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(motRandomPointInCube(MOT_BALL_RADIUS));
      const lines = ballLineTemplate.clone();
      mesh.add(lines);
      scene.add(mesh);
      balls.push({
        id: i,
        letter: letters[i],
        mesh,
        vel: motRandomUnitVector(),
        selected: false,
        isTarget: false,
      });
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clock = new THREE.Clock();

    const ctx = { scene, camera, renderer, balls, raycaster, mouse, clock, animFrame: null };
    sceneRef.current = ctx;

    const onResize = () => {
      if (!host) return;
      const { w, h } = computeMotionCanvasSize(
        host.clientWidth,
        host.getBoundingClientRect().top
      );
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      setCanvasSize({ w, h });
    };
    window.addEventListener("resize", onResize);
    onResizeRef.current = onResize;

    // Reduced offset from center (was 0.95, 0.78) for a more front-facing,
    // straight-into-the-box look — closer to eye-level and centered, with
    // just enough offset left that the side/floor/ceiling edges still read
    // as a cube rather than a flat square. Never moves — only the balls do.
    camera.position.set(0.35, 0.2, 9.0);
    camera.lookAt(0, 0, 0);

    const animate = () => {
      ctx.animFrame = requestAnimationFrame(animate);
      const dt = Math.min(ctx.clock.getDelta(), 0.05);

      if (stageRef.current === "track" && !pausedRef.current) {
        const speedNow = motDisplaySpeedToVelocity(speedRef.current);
        const bound = MOT_CUBE_HALF - MOT_BALL_RADIUS;
        ctx.balls.forEach((b) => {
          b.mesh.position.addScaledVector(b.vel, speedNow * dt);
          const p = b.mesh.position;
          // Axis-aligned reflection off each of the cube's 6 walls —
          // independent per axis, unlike the sphere's single radial check.
          ["x", "y", "z"].forEach((axis) => {
            if (p[axis] > bound) {
              p[axis] = bound;
              b.vel[axis] = -Math.abs(b.vel[axis]);
            } else if (p[axis] < -bound) {
              p[axis] = -bound;
              b.vel[axis] = Math.abs(b.vel[axis]);
            }
          });
        });

        // Ball-to-ball collisions — equal-mass elastic bounce (standard
        // "swap the velocity component along the collision normal" impulse)
        // so two balls that touch deflect off each other instead of
        // drifting straight through. Checked pairwise every frame; with
        // only 10 balls that's 45 checks, cheap either way.
        const minDist = MOT_BALL_RADIUS * 2;
        for (let i = 0; i < ctx.balls.length; i++) {
          for (let j = i + 1; j < ctx.balls.length; j++) {
            const ballA = ctx.balls[i];
            const ballB = ctx.balls[j];
            const delta = ballA.mesh.position.clone().sub(ballB.mesh.position);
            const dist = delta.length();
            if (dist > 0 && dist < minDist) {
              const normal = delta.multiplyScalar(1 / dist); // unit vector, B -> A
              // Separate them along the normal so they don't stay
              // overlapped and keep re-triggering the same collision.
              const correction = normal
                .clone()
                .multiplyScalar((minDist - dist) / 2);
              ballA.mesh.position.add(correction);
              ballB.mesh.position.sub(correction);
              // Only resolve velocity if they're actually closing — if
              // they're already separating (e.g. right after a previous
              // bounce this same frame), leave their velocities alone.
              const relVel = ballA.vel.clone().sub(ballB.vel);
              const velAlongNormal = relVel.dot(normal);
              if (velAlongNormal < 0) {
                ballA.vel.addScaledVector(normal, -velAlongNormal);
                ballB.vel.addScaledVector(normal, velAlongNormal);
              }
            }
          }
        }
      }

      ctx.balls.forEach((b, i) => {
        const label = labelRefs.current[i];
        if (!label) return;
        // Only shown once it's actually time to guess — otherwise the
        // letters double as a free "which ball is which" cheat sheet while
        // still trying to track them.
        if (stageRef.current !== "select") {
          label.style.display = "none";
          return;
        }
        const { x, y, behindCamera } = motProjectToScreen(
          b.mesh.position,
          ctx.camera,
          ctx.renderer.domElement.clientWidth,
          ctx.renderer.domElement.clientHeight
        );
        label.style.display = behindCamera ? "none" : "block";
        label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      });

      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(ctx.animFrame);
      ballGeo.dispose();
      ballLineTemplate.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      boundaryGeo.dispose();
      boundaryEdges.dispose();
      boundaryMat.dispose();
      balls.forEach((b) => b.mesh.material.dispose());
      renderer.dispose();
      host.innerHTML = "";
      sceneRef.current = null;
    };
  }, []);

  // Resets every ball to a fresh random position/direction, picks 5 new
  // targets and gives them a white glow around their edge, then hands off
  // to the track → select flow via the two setTimeouts below.
  // Resets every ball to a fresh random position/direction, picks 5 new
  // targets and colors them a medium gold/mustard to reveal them, then
  // hands off to the track → select flow via the two setTimeouts below.
  const startRound = useCallback(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    clearTimeout(stageTimeoutRef.current);
    // Marks the start of THIS round specifically — every call, including a
    // manual Restart mid-round, moves this forward. Only submitSelection
    // below ever adds to trainedMsRef, so a round that gets restarted
    // instead of answered contributes nothing to the displayed duration,
    // and mashing Restart repeatedly can't be used to pad it.
    roundStartRef.current = Date.now();

    ctx.balls.forEach((b) => {
      b.mesh.position.copy(motRandomPointInCube(MOT_BALL_RADIUS));
      b.vel.copy(motRandomUnitVector());
      b.selected = false;
      b.isTarget = false;
      b.mesh.scale.setScalar(1);
      b.mesh.material.color.setHex(MOT_COLOR_NEUTRAL);
    });

    const ids = Array.from({ length: MOT_BALL_COUNT }, (_, i) => i);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const targetIds = new Set(ids.slice(0, MOT_TARGET_COUNT));
    ctx.balls.forEach((b) => {
      b.isTarget = targetIds.has(b.id);
      if (b.isTarget) b.mesh.material.color.setHex(MOT_COLOR_TARGET);
    });

    setSelectedCount(0);
    setRoundResult(null);
    setStage("highlight");

    stageTimeoutRef.current = setTimeout(() => {
      ctx.balls.forEach((b) => b.mesh.material.color.setHex(MOT_COLOR_NEUTRAL));
      setStage("track");
      stageTimeoutRef.current = setTimeout(() => {
        setStage("select");
      }, MOT_TRACK_MS);
    }, MOT_HIGHLIGHT_MS);
  }, []);

  // No separate "Start" button anymore — the exercise begins tracking
  // immediately once the 3D scene is ready (sceneRef.current is populated
  // by the scene-setup effect above, which — since it's declared earlier in
  // this component — always finishes running first within the same
  // commit), instead of waiting on a click that was just consuming screen
  // space for no real benefit.
  useEffect(() => {
    startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scores the round, colors every ball to show what was right/wrong/missed,
  // steps the speed staircase, and queues the next round.
  const submitSelection = useCallback(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    clearTimeout(stageTimeoutRef.current);

    let correctCount = 0;
    let wrongCount = 0;
    ctx.balls.forEach((b) => {
      if (b.selected && b.isTarget) {
        correctCount += 1;
        b.mesh.material.color.setHex(MOT_COLOR_CORRECT);
      } else if (b.selected && !b.isTarget) {
        wrongCount += 1;
        b.mesh.material.color.setHex(MOT_COLOR_WRONG);
      } else if (!b.selected && b.isTarget) {
        b.mesh.material.color.setHex(MOT_COLOR_MISSED);
      }
    });
    const allCorrect = correctCount === MOT_TARGET_COUNT && wrongCount === 0;

    const newTally = {
      correct: tallyRef.current.correct + (allCorrect ? 1 : 0),
      wrong: tallyRef.current.wrong + (allCorrect ? 0 : 1),
    };
    tallyRef.current = newTally;
    setTally(newTally);
    setRoundResult({ correctCount, wrongCount, allCorrect });
    setStage("result");

    // Only the time actually spent on rounds that were answered counts —
    // summed here rather than measured as wall-clock time since the
    // session's first round, so skipped/idle time (e.g. sitting on a
    // frozen round, or mashing Restart instead of answering) never shows
    // up in the duration or counts against the 15-minute budget below.
    const thisRoundMs = roundStartRef.current ? Date.now() - roundStartRef.current : 0;
    trainedMsRef.current += thisRoundMs;
    const totalElapsedMs = trainedMsRef.current;
    setElapsedMs(totalElapsedMs);

    // Computed directly off speedRef (rather than via setSpeed's functional
    // updater) so the resulting value is known synchronously right here —
    // needed below to report the session-end summary without waiting on a
    // state update to actually commit.
    const prevSpeedValue = speedRef.current;
    const nextSpeedValue = allCorrect
      ? Math.min(MOT_MAX_SPEED, prevSpeedValue + MOT_SPEED_STEP)
      : Math.max(MOT_MIN_SPEED, prevSpeedValue - MOT_SPEED_STEP);
    const prevTier = Math.floor(prevSpeedValue / MOT_TIER_STEP);
    const nextTier = Math.floor(nextSpeedValue / MOT_TIER_STEP);
    // Only fires the shared level-up celebration when crossing into a new
    // tier — not literally every round, or it'd go off constantly since
    // speed adjusts every single round (unlike RRT's 20-in-a-row gate).
    if (nextTier > prevTier) {
      onLevelUp?.(nextTier, nextSpeedValue, `3D Motion — speed ${nextSpeedValue.toFixed(2)}`);
    }
    speedRef.current = nextSpeedValue;
    setSpeed(nextSpeedValue);

    const sessionBudgetMs = exercise.sessionDurationMs || 15 * 60 * 1000;
    stageTimeoutRef.current = setTimeout(() => {
      if (totalElapsedMs >= sessionBudgetMs) {
        // Logs this session into exerciseHistory.motion3d (what feeds the
        // Overview graph) and exerciseStats.motion3d's session/average
        // tracking — mirroring how every other exercise reports a
        // completed session, which 3D Motion never did before, so it never
        // showed up on the graph at all. Guarded on at least one round
        // actually being answered so the natural end-of-session path can't
        // log an empty entry.
        if (newTally.correct + newTally.wrong > 0) {
          onSessionEnd?.({
            speedReached: nextSpeedValue,
            tierReached: nextTier,
            durationMs: totalElapsedMs,
          });
        }
        onFinish?.();
      } else {
        startRound();
      }
    }, 1800);
  }, [onLevelUp, onSessionEnd, onFinish, exercise.sessionDurationMs, startRound]);

  // Auto-submits once 5 are picked — no separate confirm step needed for
  // the common case, but the Submit button below still covers "I only got
  // some of them, just score what I have."
  useEffect(() => {
    if (stage === "select" && selectedCount === MOT_TARGET_COUNT) {
      submitSelection();
    }
  }, [stage, selectedCount, submitSelection]);

  useEffect(
    () => () => clearTimeout(stageTimeoutRef.current),
    []
  );

  const toggleBallSelection = (ball) => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    if (ball.selected) {
      ball.selected = false;
      ball.mesh.scale.setScalar(1);
      ball.mesh.material.color.setHex(MOT_COLOR_NEUTRAL);
      setSelectedCount((c) => c - 1);
    } else {
      const currentlySelected = ctx.balls.filter((b) => b.selected).length;
      if (currentlySelected >= MOT_TARGET_COUNT) return;
      ball.selected = true;
      ball.mesh.material.color.setHex(ball.isTarget ? MOT_COLOR_CORRECT : MOT_COLOR_WRONG);
      setSelectedCount((c) => c + 1);
    }
  };

  const handleCanvasClick = (e) => {
    const ctx = sceneRef.current;
    if (!ctx || stageRef.current !== "select") return;
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    ctx.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ctx.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ctx.raycaster.setFromCamera(ctx.mouse, ctx.camera);
    const hits = ctx.raycaster.intersectObjects(ctx.balls.map((b) => b.mesh));
    if (!hits.length) return;
    const ball = ctx.balls.find((b) => b.mesh === hits[0].object);
    if (!ball) return;
    toggleBallSelection(ball);
  };

  // Lets each ball be picked by its letter key instead of requiring a
  // precise click — same effect as clicking it, just keyboard-driven.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (stageRef.current !== "select") return;
      const ctx = sceneRef.current;
      if (!ctx) return;
      // Ignore modified keypresses (Cmd/Ctrl/Alt shortcuts) and typing
      // into any actual input/textarea elsewhere on the page.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      const ball = ctx.balls.find((b) => b.letter === key);
      if (!ball) return;
      e.preventDefault();
      toggleBallSelection(ball);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* No card border/padding/background here anymore — the canvas fills
          the entire space this component is given, edge to edge. No setup
          screen either: the exercise starts tracking on its own as soon as
          the scene is ready (see the mount effect above), so there's
          nothing to click through first. */}
      <div
        ref={canvasHostRef}
        onClick={handleCanvasClick}
        className="relative w-full bg-slate-950 overflow-hidden"
        style={{ height: canvasSize.h, cursor: stage === "select" ? "pointer" : "default" }}
      >
        <div ref={canvasMountRef} className="absolute inset-0" />

        {ballLetters.map((letter, i) => (
          <div
            key={i}
            ref={(el) => (labelRefs.current[i] = el)}
            className="absolute top-0 left-0 pointer-events-none font-bold text-white select-none"
            style={{
              fontSize: `${Math.round(canvasSize.h * 0.032)}px`,
              lineHeight: 1,
              // Lowercase now (was uppercase — read as too imposing/heavy
              // at this size). Ascenders/descenders in letters like d, f,
              // h, k, l (taller) and g (dips below the baseline) mean these
              // won't all read as perfectly uniform height the way capitals
              // did, but that's an accepted tradeoff for the softer look.
              // The actual key the person presses is unaffected either way
              // — that's matched against the lowercase letter in
              // MOT_KEY_LETTERS regardless of how it's displayed.
              WebkitTextStroke: "1.5px rgba(15,23,42,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              display: "none",
            }}
          >
            {letter}
          </div>
        ))}

        <div
          className="absolute top-1/2 left-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full bg-slate-200/80 pointer-events-none"
          style={{ boxShadow: "0 0 6px 2px rgba(226,232,240,0.35)" }}
        />

        {/* Total elapsed session time — only updates when submitSelection
            runs (i.e. right after an answer), so it holds steady during a
            live round and refreshes exactly when the result screen shows,
            right before the next round starts. This is the same number
            submitSelection checks against exercise.sessionDurationMs to end
            the session, so what's on screen always matches what's about to
            trigger the cutoff. */}
        <div className="absolute top-3 left-3 text-sm font-medium text-slate-200 bg-slate-950/70 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-none">
          {formatDuration(elapsedMs)}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Fast-forwards the trained-time accumulator itself (rather
            // than faking a start timestamp, which no longer exists) so it
            // looks like the full budget has already been spent, then ends
            // the session exactly the way the real 15-minute cutoff does —
            // for testing what happens at the end without waiting 15 real
            // minutes every time.
            const sessionBudgetMs = exercise.sessionDurationMs || 15 * 60 * 1000;
            trainedMsRef.current = sessionBudgetMs + 1000;
            setElapsedMs(trainedMsRef.current);
            if (tallyRef.current.correct + tallyRef.current.wrong > 0) {
              onSessionEnd?.({
                speedReached: speedRef.current,
                tierReached: Math.floor(speedRef.current / MOT_TIER_STEP),
                durationMs: trainedMsRef.current,
              });
            }
            onFinish?.();
          }}
          className="absolute top-12 left-3 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-950/70 hover:bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1 transition-colors"
        >
          🧪 Simulate 15 min elapsed
        </button>

        {onResetProgress && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResetProgress();
            }}
            className="absolute top-[5.25rem] left-3 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-950/70 hover:bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1 transition-colors"
          >
            🧪 Reset progress (fixes stale achievements)
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            startRound();
          }}
          className="absolute top-3 right-3 text-sm font-medium text-slate-200 bg-slate-950/70 hover:bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 transition-colors"
        >
          Restart Game
        </button>
        <div className="absolute top-12 right-3 text-xs text-slate-400 bg-slate-950/70 backdrop-blur-sm rounded-lg px-3 py-1 pointer-events-none">
          Speed: {speed.toFixed(2)}
        </div>
        <div className="absolute top-[5.5rem] right-3 flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSpeed((s) => Math.max(MOT_MIN_SPEED, s - MOT_SPEED_STEP));
            }}
            className="text-xs font-medium text-slate-300 bg-slate-950/70 hover:bg-slate-800/80 backdrop-blur-sm rounded-lg px-2.5 py-1 transition-colors"
          >
            − Speed
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSpeed((s) => Math.min(MOT_MAX_SPEED, s + MOT_SPEED_STEP));
            }}
            className="text-xs font-medium text-slate-300 bg-slate-950/70 hover:bg-slate-800/80 backdrop-blur-sm rounded-lg px-2.5 py-1 transition-colors"
          >
            + Speed
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, size = "lg", accent }) {
  const valueClass = size === "sm" ? "text-sm" : "text-base";
  const cardClass = accent
    ? `${accent.bg} border ${accent.border}`
    : "bg-slate-900 border border-slate-700/60";
  return (
    <div className={`${cardClass} rounded-lg p-6`}>
      <div className="text-slate-300 text-lg font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className={`${valueClass} font-medium mt-2`} style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

// Small on/off pill switch — used for the binaural beats toggle. Purely a UI
// toggle (no audio engine wired up yet).
function Toggle({ on, onToggle, accent }) {
  const acc = accent || ACCENT_STYLES.indigo;
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${
        on ? `bg-gradient-to-r ${acc.grad}` : "bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
