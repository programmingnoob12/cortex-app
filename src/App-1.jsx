import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, Fragment, Component } from "react";
import * as THREE from "three";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@supabase/supabase-js";
import { loadStripe } from "@stripe/stripe-js";
import BillingCardForm from "./BillingCardForm";

const STRIPE_PUBLISHABLE_KEY = "pk_test_51LWmPKIUM9SdKsj1bdD2uLndjdet0b306mTFPXNXRw9lPt6swwW8Ab5F2dLwmvku3jcGL2ur5pHfl6rryakxEmT000QkCO4SuI";
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// Where a lapsed or failed-payment member is sent to put a card in and
// start a subscription again.
const CHECKOUT_URL = "https://cortex-app-beryl.vercel.app/";

// =======================================================================
// THEME OVERRIDE — dark palette
// =======================================================================
// The palette is applied as a stylesheet that remaps the Tailwind colour
// utilities the app already uses (slate/indigo/emerald/... -> the new
// tokens) instead of rewriting every className to an arbitrary value like
// `bg-[#08090A]`, because the preview environment doesn't always generate
// arbitrary-value colour classes — when it doesn't, every colour class
// silently drops out and the whole app renders unstyled/light.
// Appended to <head> at module load so it applies everywhere, including
// the login screen. Gem tiers, task stimuli (n-back colours, RRT palette,
// Voronoi accents), avatar backgrounds and badge frames are deliberately
// untouched.
const THEME_CSS = `
:root{--bg:#08090A;--surface:#101112;--surface-raised:#18191B;--border:#23252A;
--text:#F7F8F8;--text-muted:#8A8F98;--text-dim:#6E7178;
--primary:#4CB9D8;--primary-hover:#5FC5E0;--primary-text:#8FD8EC;
--green:#4CB782;--red:#EB5757;--yellow:#F2C94C;--cyan:#4CB9D8;--violet:#8B7FE8;--lime:#68CC58;
color-scheme:dark;}
html,body{background-color:#08090A;color:#F7F8F8;}
.accent-indigo-500{accent-color:var(--ex) !important}
.accent-teal-500{accent-color:var(--ex) !important}
.bg-amber-400{background-color:#B08D34 !important}
.bg-amber-500\\/10{background-color:rgba(176,141,52,0.1) !important}
.bg-amber-500\\/20{background-color:rgba(176,141,52,0.2) !important}
.bg-amber-500\\/90{background-color:rgba(176,141,52,0.9) !important}
.bg-amber-950\\/40{background-color:rgba(42,35,20,0.4) !important}
.bg-cyan-400{background-color:var(--ex) !important}
.bg-cyan-500\\/10{background-color:color-mix(in srgb, var(--ex) 10%, transparent) !important}
.bg-emerald-400{background-color:#4CB782 !important}
.bg-emerald-500{background-color:#4CB782 !important}
.bg-emerald-500\\/10{background-color:rgba(76,183,130,0.1) !important}
.bg-emerald-500\\/20{background-color:rgba(76,183,130,0.2) !important}
.bg-emerald-500\\/90{background-color:rgba(76,183,130,0.9) !important}
.bg-emerald-600{background-color:#4CB782 !important}
.bg-emerald-950\\/40{background-color:rgba(20,42,32,0.4) !important}
.bg-green-950\\/20{background-color:rgba(20,42,32,0.2) !important}
.bg-indigo-400{background-color:var(--ex) !important}
.bg-indigo-500{background-color:var(--ex) !important}
.bg-indigo-500\\/10{background-color:color-mix(in srgb, var(--ex) 10%, transparent) !important}
.bg-indigo-600\\/20{background-color:rgba(76,185,216,0.2) !important}
.bg-indigo-950\\/40{background-color:rgba(16,35,42,0.4) !important}
.bg-lime-400{background-color:#68CC58 !important}
.bg-lime-500\\/10{background-color:rgba(104,204,88,0.1) !important}
.bg-lime-500\\/20{background-color:rgba(104,204,88,0.2) !important}
.bg-red-500{background-color:#EB5757 !important}
.bg-red-500\\/10{background-color:rgba(235,87,87,0.1) !important}
.bg-red-500\\/20{background-color:rgba(235,87,87,0.2) !important}
.bg-red-950\\/30{background-color:rgba(42,20,22,0.3) !important}
.bg-red-950\\/40{background-color:rgba(42,20,22,0.4) !important}
.bg-rose-400{background-color:#EB5757 !important}
.bg-rose-500\\/10{background-color:rgba(235,87,87,0.1) !important}
.bg-rose-500\\/90{background-color:rgba(235,87,87,0.9) !important}
.bg-rose-600{background-color:#EB5757 !important}
.bg-slate-200\\/80{background-color:rgba(247,248,248,0.8) !important}
.bg-slate-700{background-color:#23252A !important}
.bg-slate-800{background-color:#18191B !important}
.bg-slate-800\\/40{background-color:rgba(24,25,27,0.4) !important}
.bg-slate-800\\/60{background-color:rgba(24,25,27,0.6) !important}
.bg-slate-900{background-color:#101112 !important}
.bg-slate-900\\/60{background-color:rgba(16,17,18,0.6) !important}
.bg-slate-900\\/70{background-color:rgba(16,17,18,0.7) !important}
.bg-slate-900\\/90{background-color:rgba(16,17,18,0.9) !important}
.bg-slate-950{background-color:#08090A !important}
.bg-slate-950\\/70{background-color:rgba(8,9,10,0.7) !important}
.bg-slate-950\\/80{background-color:rgba(8,9,10,0.8) !important}
.bg-slate-950\\/90{background-color:rgba(8,9,10,0.9) !important}
.bg-stone-200{background-color:#F7F8F8 !important}
.bg-teal-700{background-color:var(--ex) !important}
.bg-violet-400{background-color:#8B7FE8 !important}
.bg-violet-400\\/25{background-color:rgba(139,127,232,0.25) !important}
.bg-violet-500\\/10{background-color:rgba(139,127,232,0.1) !important}
.bg-violet-600\\/15{background-color:rgba(139,127,232,0.15) !important}
.border-amber-400{border-color:#D9B65A !important}
.border-amber-500\\/40{border-color:rgba(217,182,90,0.4) !important}
.border-amber-800{border-color:#D9B65A !important}
.border-cyan-400{border-color:var(--ex) !important}
.border-cyan-500\\/40{border-color:color-mix(in srgb, var(--ex) 40%, transparent) !important}
.border-emerald-400{border-color:#4CB782 !important}
.border-emerald-500\\/40{border-color:rgba(76,183,130,0.4) !important}
.border-emerald-800{border-color:#4CB782 !important}
.border-green-700{border-color:#4CB782 !important}
.border-indigo-400{border-color:var(--ex) !important}
.border-indigo-500{border-color:var(--ex) !important}
.border-indigo-500\\/40{border-color:color-mix(in srgb, var(--ex) 40%, transparent) !important}
.border-lime-400{border-color:#68CC58 !important}
.border-lime-500\\/40{border-color:rgba(104,204,88,0.4) !important}
.border-orange-400\\/30{border-color:rgba(217,182,90,0.3) !important}
.border-orange-400\\/40{border-color:rgba(217,182,90,0.4) !important}
.border-orange-400\\/60{border-color:rgba(217,182,90,0.6) !important}
.border-red-600{border-color:#EB5757 !important}
.border-red-900{border-color:#EB5757 !important}
.border-rose-400{border-color:#EB5757 !important}
.border-rose-400\\/30{border-color:rgba(235,87,87,0.3) !important}
.border-rose-500\\/40{border-color:rgba(235,87,87,0.4) !important}
.border-slate-500{border-color:#2E3138 !important}
.border-slate-600{border-color:#23252A !important}
.border-slate-600\\/70{border-color:rgba(35,37,42,0.7) !important}
.border-slate-700{border-color:#23252A !important}
.border-slate-700\\/60{border-color:rgba(35,37,42,0.6) !important}
.border-slate-700\\/70{border-color:rgba(35,37,42,0.7) !important}
.border-slate-800{border-color:#18191B !important}
.border-slate-800\\/70{border-color:rgba(24,25,27,0.7) !important}
.border-slate-950{border-color:#08090A !important}
.border-stone-300{border-color:#3A3D44 !important}
.border-violet-400{border-color:#8B7FE8 !important}
.border-violet-400\\/40{border-color:rgba(139,127,232,0.4) !important}
.border-violet-500\\/40{border-color:rgba(139,127,232,0.4) !important}
.disabled\\:hover\\:bg-slate-700:disabled:hover{background-color:#23252A !important}
.disabled\\:hover\\:bg-teal-700:disabled:hover{background-color:var(--ex) !important}
.focus\\:border-indigo-400:focus{border-color:var(--ex) !important}
.focus\\:border-indigo-500:focus{border-color:var(--ex) !important}
.focus\\:border-teal-500:focus{border-color:var(--ex) !important}
.from-amber-500{--tw-gradient-from:#B08D34 !important}
.from-amber-500\\/50{--tw-gradient-from:rgba(176,141,52,0.5) !important}
.from-cyan-400{--tw-gradient-from:var(--ex) !important}
.from-cyan-500{--tw-gradient-from:var(--ex) !important}
.from-cyan-600\\/50{--tw-gradient-from:color-mix(in srgb, var(--ex) 50%, transparent) !important}
.from-emerald-500{--tw-gradient-from:#4CB782 !important}
.from-fuchsia-600\\/50{--tw-gradient-from:rgba(139,127,232,0.5) !important}
.from-indigo-500{--tw-gradient-from:var(--ex) !important}
.from-indigo-600\\/50{--tw-gradient-from:color-mix(in srgb, var(--ex) 50%, transparent) !important}
.from-lime-500{--tw-gradient-from:#68CC58 !important}
.from-orange-400{--tw-gradient-from:#B08D34 !important}
.from-orange-500\\/20{--tw-gradient-from:rgba(176,141,52,0.2) !important}
.from-rose-500{--tw-gradient-from:#EB5757 !important}
.from-rose-600{--tw-gradient-from:#EB5757 !important}
.from-slate-800{--tw-gradient-from:#18191B !important}
.from-teal-500{--tw-gradient-from:var(--ex) !important}
.from-violet-500{--tw-gradient-from:#8B7FE8 !important}
.from-violet-500\\/20{--tw-gradient-from:rgba(139,127,232,0.2) !important}
.group:hover .group-hover\\:text-indigo-300{color:var(--ex) !important}
.hover\\:bg-emerald-500:hover{background-color:#4CB782 !important}
.hover\\:bg-indigo-400:hover{background-color:var(--ex) !important}
.hover\\:bg-red-950\\/60:hover{background-color:rgba(42,20,22,0.6) !important}
.hover\\:bg-rose-500:hover{background-color:#EB5757 !important}
.hover\\:bg-slate-600:hover{background-color:#2E3138 !important}
.hover\\:bg-slate-700:hover{background-color:#23252A !important}
.hover\\:bg-slate-800:hover{background-color:#18191B !important}
.hover\\:bg-slate-800\\/80:hover{background-color:rgba(24,25,27,0.8) !important}
.hover\\:bg-teal-600:hover{background-color:var(--ex) !important}
.hover\\:border-amber-400:hover{border-color:#D9B65A !important}
.hover\\:border-amber-400\\/40:hover{border-color:rgba(217,182,90,0.4) !important}
.hover\\:border-cyan-400:hover{border-color:var(--ex) !important}
.hover\\:border-emerald-400:hover{border-color:#4CB782 !important}
.hover\\:border-emerald-400\\/40:hover{border-color:rgba(76,183,130,0.4) !important}
.hover\\:border-indigo-400:hover{border-color:var(--ex) !important}
.hover\\:border-indigo-400\\/40:hover{border-color:color-mix(in srgb, var(--ex) 40%, transparent) !important}
.hover\\:border-lime-400:hover{border-color:#68CC58 !important}
.hover\\:border-red-400\\/40:hover{border-color:rgba(235,87,87,0.4) !important}
.hover\\:border-rose-400:hover{border-color:#EB5757 !important}
.hover\\:border-slate-300:hover{border-color:#3A3D44 !important}
.hover\\:border-slate-400:hover{border-color:#3A3D44 !important}
.hover\\:border-slate-500:hover{border-color:#2E3138 !important}
.hover\\:border-slate-600:hover{border-color:#23252A !important}
.hover\\:border-teal-400\\/40:hover{border-color:color-mix(in srgb, var(--ex) 40%, transparent) !important}
.hover\\:border-violet-400:hover{border-color:#8B7FE8 !important}
.hover\\:from-violet-500\\/30:hover{--tw-gradient-from:rgba(139,127,232,0.3) !important}
.hover\\:shadow-amber-500\\/10:hover{--tw-shadow-color:rgba(176,141,52,0.1) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.hover\\:shadow-emerald-500\\/10:hover{--tw-shadow-color:rgba(76,183,130,0.1) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.hover\\:shadow-indigo-500\\/10:hover{--tw-shadow-color:color-mix(in srgb, var(--ex) 10%, transparent) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.hover\\:shadow-teal-500\\/10:hover{--tw-shadow-color:color-mix(in srgb, var(--ex) 10%, transparent) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.hover\\:shadow-violet-500\\/30:hover{--tw-shadow-color:rgba(139,127,232,0.3) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.hover\\:text-indigo-300:hover{color:var(--ex) !important}
.hover\\:text-slate-200:hover{color:#F7F8F8 !important}
.hover\\:text-slate-300:hover{color:#8A8F98 !important}
.hover\\:to-fuchsia-500\\/30:hover{--tw-gradient-to:rgba(139,127,232,0.3) !important}
.placeholder-slate-500::placeholder{color:#6E7178 !important}
.placeholder\\:text-slate-500::placeholder{color:#6E7178 !important}
.shadow-orange-950\\/40{--tw-shadow-color:rgba(42,35,20,0.4) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.shadow-rose-950\\/40{--tw-shadow-color:rgba(42,20,22,0.4) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.shadow-violet-950\\/50{--tw-shadow-color:rgba(30,26,46,0.5) !important;--tw-shadow:var(--tw-shadow-colored) !important}
.text-amber-300{color:#D9B65A !important}
.text-amber-400{color:#D9B65A !important}
.text-cyan-300{color:var(--ex) !important}
.text-emerald-300{color:#4CB782 !important}
.text-emerald-400{color:#4CB782 !important}
.text-green-400{color:#4CB782 !important}
.text-indigo-300{color:var(--ex) !important}
.text-indigo-400{color:var(--ex) !important}
.text-lime-300{color:#68CC58 !important}
.text-orange-100{color:#D9B65A !important}
.text-orange-400{color:#D9B65A !important}
.text-red-300{color:#EB5757 !important}
.text-red-400{color:#EB5757 !important}
.text-red-500{color:#EB5757 !important}
.text-rose-300{color:#EB5757 !important}
.text-rose-400{color:#EB5757 !important}
.text-slate-100{color:#F7F8F8 !important}
.text-slate-200{color:#F7F8F8 !important}
.text-slate-300{color:#8A8F98 !important}
.text-slate-400{color:#A7AEB9 !important}
.text-slate-500{color:#98A0AB !important}
.text-slate-600{color:#89909B !important}
.text-violet-100{color:#8B7FE8 !important}
.text-violet-300{color:#8B7FE8 !important}
.to-blue-700\\/40{--tw-gradient-to:color-mix(in srgb, var(--ex) 40%, transparent) !important}
.to-cyan-400{--tw-gradient-to:var(--ex) !important}
.to-fuchsia-500{--tw-gradient-to:#8B7FE8 !important}
.to-fuchsia-500\\/20{--tw-gradient-to:rgba(139,127,232,0.2) !important}
.to-fuchsia-600\\/40{--tw-gradient-to:rgba(139,127,232,0.4) !important}
.to-indigo-900\\/50{--tw-gradient-to:color-mix(in srgb, var(--ex) 50%, transparent) !important}
.to-lime-400{--tw-gradient-to:#68CC58 !important}
.to-orange-500{--tw-gradient-to:#B08D34 !important}
.to-pink-500{--tw-gradient-to:#8B7FE8 !important}
.to-red-500{--tw-gradient-to:#EB5757 !important}
.to-red-500\\/20{--tw-gradient-to:rgba(235,87,87,0.2) !important}
.to-rose-500\\/40{--tw-gradient-to:rgba(235,87,87,0.4) !important}
.to-sky-500{--tw-gradient-to:var(--ex) !important}
.to-slate-900{--tw-gradient-to:#101112 !important}
.to-teal-300{--tw-gradient-to:var(--ex) !important}
.to-teal-500{--tw-gradient-to:var(--ex) !important}
.via-orange-500\\/40{--tw-gradient-via:rgba(176,141,52,0.4) !important;--tw-gradient-stops:var(--tw-gradient-from), rgba(176,141,52,0.4), var(--tw-gradient-to) !important}
.via-purple-700\\/40{--tw-gradient-via:rgba(139,127,232,0.4) !important;--tw-gradient-stops:var(--tw-gradient-from), rgba(139,127,232,0.4), var(--tw-gradient-to) !important}
.via-sky-600\\/40{--tw-gradient-via:rgba(76,185,216,0.4) !important;--tw-gradient-stops:var(--tw-gradient-from), rgba(76,185,216,0.4), var(--tw-gradient-to) !important}
.via-violet-600\\/40{--tw-gradient-via:rgba(139,127,232,0.4) !important;--tw-gradient-stops:var(--tw-gradient-from), rgba(139,127,232,0.4), var(--tw-gradient-to) !important}
.rrt-flash{animation:rrtFlashIn .18s ease-out}
@keyframes rrtFlashIn{from{opacity:0}to{opacity:1}}
.rank-glow{position:relative}
.rank-glow::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:0 0 24px 6px rgba(250,204,21,0.5), inset 0 0 0 1px rgba(250,204,21,0.7);animation:rankGlowFade 2.6s ease-in-out infinite;will-change:opacity}
@keyframes rankGlowFade{0%,100%{opacity:.4}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.rank-glow::after{animation:none;opacity:.7}}
.nback-stimulus{width:80%;height:80%;display:flex;align-items:center;justify-content:center}
.nback-stimulus>svg{width:100% !important;height:100% !important}
.to-violet-500{--tw-gradient-to:#5FC5E0 !important}
`;
if (typeof document !== "undefined" && !document.getElementById("app-theme-override")) {
  const el = document.createElement("style");
  el.id = "app-theme-override";
  el.textContent = THEME_CSS;
  document.head.appendChild(el);
}


// ---------------------------------------------------------------------
// PRODUCTION BACKEND — Supabase (Postgres + Auth + Row-Level Security)
// ---------------------------------------------------------------------
const SUPABASE_URL = "https://sdvfacmhljkwojvmtflr.supabase.co";
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

// Per-user cache of the last membership answer, so a returning member is
// not held at a loading screen while the same question is asked again.
const MEMBERSHIP_CACHE_PREFIX = "cortex.membershipOk.";

function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [authError, setAuthError] = useState("");
  // null = not known yet. Seeded from the last known answer for this user so
  // a returning member goes straight into the app instead of waiting on a
  // round trip; the real check still runs underneath and corrects it.
  const [membershipOk, setMembershipOk] = useState(null);
  // The raw value behind membershipOk — "paused", "past_due", "inactive" —
  // so a locked-out person is told which one applies and offered the action
  // that actually fixes it, instead of a single dead-end message.
  const [membershipStatus, setMembershipStatus] = useState(null);
  const membershipOkRef = useRef(null);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverError, setRecoverError] = useState("");
  // 'magic' | 'password' | 'forgot' | 'forgotSent' | 'recovery' — which
  // form the signed-out screen shows. 'recovery' is a special case:
  // Supabase puts the user into an authenticated-but-recovering session
  // when they click a password-reset email link, detected below via
  // onAuthStateChange's PASSWORD_RECOVERY event, and they must set a new
  // password before anything else proceeds.
  const [mode, setMode] = useState("magic");
  const [newPassword, setNewPassword] = useState("");
  const [passwordPrompt, setPasswordPrompt] = useState(null); // null = not decided yet, true = show it, false = skip

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
      }
      setSession(s ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    membershipOkRef.current = membershipOk;
  }, [membershipOk]);

  useEffect(() => {
    if (!session?.user) {
      setMembershipOk(null);
      return;
    }
    // Paint from cache first. This is a convenience, not a security boundary:
    // every read of member data is enforced server-side by RLS, so a stale
    // "true" here buys nothing beyond a few hundred milliseconds of UI that
    // the check below immediately corrects.
    try {
      const cached = localStorage.getItem(MEMBERSHIP_CACHE_PREFIX + session.user.id);
      if (cached) {
        const parsed = JSON.parse(cached);
        setMembershipStatus(parsed.status ?? null);
        setMembershipOk(!!parsed.ok);
      }
    } catch {
      // Unreadable cache just means the normal wait.
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("membership_status, current_period_end")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // A failed request is not proof of a lapsed membership. With a
        // cached answer in hand, keep showing it rather than throwing a
        // paying member out over a dropped connection.
        if (membershipOkRef.current === null) {
          setMembershipStatus(null);
          setMembershipOk(false);
        }
        return;
      }
      setMembershipStatus(data?.membership_status || null);
      // Access is granted while the period they already paid for is still
      // running, even if the status has moved to paused or past_due. That
      // period is theirs — a pause or a failed card only takes effect once
      // it runs out. Only "inactive" (the subscription actually ended)
      // locks immediately, and by then the period is over anyway.
      const paidUntil = data?.current_period_end
        ? new Date(data.current_period_end).getTime()
        : null;
      const stillInPaidPeriod =
        data?.membership_status !== "inactive" && paidUntil !== null && paidUntil > Date.now();
      const ok = data?.membership_status === "active" || stillInPaidPeriod;
      setMembershipOk(ok);
      try {
        localStorage.setItem(
          MEMBERSHIP_CACHE_PREFIX + session.user.id,
          JSON.stringify({ ok, status: data?.membership_status || null })
        );
      } catch {
        // Cache is optional.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (session?.user && membershipOk) {
      window.storage = makeSupabaseStorage(session.user.id);
      // One-time "set a password" nudge — a plain localStorage flag keyed
      // by user id is enough here (it just controls whether a dismissible
      // prompt reappears on this browser; it isn't account data, so it
      // doesn't need to live in Supabase or sync across devices).
      const seenKey = `password_prompt_seen_${session.user.id}`;
      if (mode !== "recovery") {
        setPasswordPrompt(!localStorage.getItem(seenKey));
      }
    }
  }, [session, membershipOk, mode]);

  const handleSendLink = async (e) => {
    e.preventDefault();
    if (sendingLink) return;
    setAuthError("");
    setSendingLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      setLinkSent(true);
    } catch (err) {
      setAuthError(err?.message || "Could not reach the sign-in service.");
    } finally {
      setSendingLink(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setMode("forgotSent");
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setAuthError(error.message);
      return;
    }
    // Recovery complete — the session Supabase gave them during recovery
    // is now a normal authenticated session, so just fall through to the
    // regular membership check / app render below.
    setMode("magic");
  };

  const handleSkipPasswordPrompt = () => {
    if (session?.user) localStorage.setItem(`password_prompt_seen_${session.user.id}`, "1");
    setPasswordPrompt(false);
  };

  const handleSetPasswordFromPrompt = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setAuthError(error.message);
      return;
    }
    if (session?.user) localStorage.setItem(`password_prompt_seen_${session.user.id}`, "1");
    setPasswordPrompt(false);
  };

  if (session === undefined) {
    // Bare background rather than a "Loading…" line. The wait is one read of
    // the stored session, and a word on screen for a few hundred
    // milliseconds reads as a slower app than an empty page does.
    return <div className="min-h-screen bg-slate-950" />;
  }

  // A password-recovery session takes priority over everything else —
  // the person clicked a "reset your password" email link and needs to
  // set a new one before they can do anything else in the app.
  if (mode === "recovery") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-5">
          <h1 className="text-2xl font-semibold text-center">Set a new password</h1>
          <form onSubmit={handleSetNewPassword} className="space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-400 transition-colors rounded-lg py-3 text-base font-medium"
            >
              Save new password
            </button>
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
          </form>
        </div>
      </div>
    );
  }

  if (!session) {
    if (mode === "forgotSent") {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-4 text-center">
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <p className="text-slate-300 text-base">
              We've sent a password reset link to <span className="font-medium">{email}</span>.
            </p>
            <button
              onClick={() => setMode("magic")}
              className="text-indigo-400 text-sm hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      );
    }

    if (mode === "forgot") {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-5">
            <h1 className="text-2xl font-semibold text-center">Reset your password</h1>
            <form onSubmit={handleForgotPassword} className="space-y-3">
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
                Send reset link
              </button>
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
            </form>
            <button
              onClick={() => setMode("magic")}
              className="w-full text-center text-indigo-400 text-sm hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      );
    }

    if (mode === "password") {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-5">
            <h1 className="text-2xl font-semibold text-center">Sign in</h1>
            <form onSubmit={handlePasswordLogin} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                className="w-full bg-indigo-500 hover:bg-indigo-400 transition-colors rounded-lg py-3 text-base font-medium"
              >
                Sign in
              </button>
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
            </form>
            <div className="flex justify-between text-sm">
              <button onClick={() => setMode("magic")} className="text-indigo-400 hover:underline">
                Use email link instead
              </button>
              <button onClick={() => setMode("forgot")} className="text-slate-400 hover:underline">
                Forgot password?
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default: magic-link sign in
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-5">
          <h1 className="text-2xl font-semibold text-center">Sign in</h1>
          {linkSent ? (
            <p className="text-slate-300 text-center text-base">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </p>
          ) : (
            <>
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
                  disabled={sendingLink}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 transition-colors rounded-lg py-3 text-base font-medium"
                >
                  {sendingLink ? "Sending\u2026" : "Send sign-in link"}
                </button>
                {authError && <p className="text-red-400 text-sm">{authError}</p>}
              </form>
              <button
                onClick={() => setMode("password")}
                className="w-full text-center text-indigo-400 text-sm hover:underline"
              >
                Have a password? Sign in with it instead
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (membershipOk === null) {
    // No interstitial. On the first check of a new browser this is a blank
    // dark page for a moment, which reads as the app still loading rather
    // than as a step it is making the person wait through.
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!membershipOk) {
    // Each locked-out state gets its own explanation and its own way out.
    // A paused member especially must be able to come back from here —
    // otherwise taking a break is a trap, since the Membership screen sits
    // behind this very gate.
    const COPY = {
      paused: {
        title: "Your membership is paused",
        body: "Training is on hold until your break ends. Your streak and scores are saved. You can come back any time.",
        action: "Come back now",
      },
      past_due: {
        title: "Your card was declined",
        body: "Your card was declined so training is on hold. Update your card to rejoin.",
        action: "Update card",
      },
      inactive: {
        title: "Your membership has ended",
        body: "Your streak and scores are still saved. Rejoin and everything is where you left it.",
        action: "Rejoin",
      },
    };
    const state = COPY[membershipStatus] || {
      title: "No active membership found",
      body: "This account isn't linked to an active membership. If you just joined, this can take a minute to sync.",
      action: null,
    };

    const handleRecover = async () => {
      setRecoverBusy(true);
      setRecoverError("");
      try {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (membershipStatus === "paused") {
          const res = await fetch("/api/billing/resume", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authSession?.access_token}`,
            },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not resume");
          window.location.reload();
          return;
        }
        // Restart on the account they are signed in to, reusing their saved
        // card. Going to the public checkout would provision by whatever
        // email they type there — a different address means a brand new
        // account and their history is stranded. Only fall back to checkout
        // when there is genuinely no card on file, and carry their email in
        // the URL so it is at least the address suggested to them.
        const res = await fetch("/api/billing/rejoin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token}`,
          },
          body: JSON.stringify({ plan: "monthly" }),
        });
        const data = await res.json();
        if (res.ok) {
          window.location.reload();
          return;
        }
        if (data.error === "NO_SAVED_CARD") {
          const email = authSession?.user?.email || "";
          window.location.href = `${CHECKOUT_URL}?email=${encodeURIComponent(email)}`;
          return;
        }
        throw new Error(data.error || "Could not restart your membership");
      } catch (err) {
        setRecoverError(err.message);
      } finally {
        setRecoverBusy(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-3 text-center">
          <h1 className="text-xl font-semibold">{state.title}</h1>
          <p className="text-slate-400 text-base">{state.body}</p>
          {recoverError && <p className="text-red-400 text-sm">{recoverError}</p>}
          {state.action && (
            <button
              onClick={handleRecover}
              disabled={recoverBusy}
              className="w-full bg-indigo-500 hover:opacity-90 disabled:opacity-50 transition-opacity text-white font-semibold rounded-lg px-4 py-3 text-base"
            >
              {recoverBusy ? "Just a moment…" : state.action}
            </button>
          )}
          {/* Refresh is only useful for the sync case, where the fix really
              is to wait a moment and look again. On paused / ended / failed
              card it is noise — the action button above is the way out. */}
          {!state.action && (
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 py-3 text-base"
            >
              Refresh
            </button>
          )}
          <button
            onClick={() => {
              try {
                localStorage.removeItem("cortex.billingState");
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("cortex.membershipOk."))
                  .forEach((k) => localStorage.removeItem(k));
              } catch {}
              supabase.auth.signOut();
            }}
            className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 py-3 text-base"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // One-time, skippable prompt shown after a successful login, letting
  // someone who signed in via magic link set a password so future logins
  // don't require waiting on email. Purely optional — skipping it changes
  // nothing about their account or data.
  if (passwordPrompt) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-5">
          <h1 className="text-2xl font-semibold text-center">Set a password?</h1>
          <p className="text-slate-400 text-sm text-center">
            Optional. Lets you sign in directly next time instead of waiting on an email link.
          </p>
          <form onSubmit={handleSetPasswordFromPrompt} className="space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Choose a password"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-400 transition-colors rounded-lg py-3 text-base font-medium"
            >
              Save password
            </button>
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
          </form>
          <button
            onClick={handleSkipPasswordPrompt}
            className="w-full text-center text-slate-400 text-sm hover:underline"
          >
            Skip for now
          </button>
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
              The app hit an unexpected error. It's been logged. Reloading
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
// n-back grid chrome — a neutral lattice, deliberately outside the accent
// system so the grid never picks up an exercise colour.
const NBACK_GRID_LINE = "#8A8F98";
const NBACK_CELL_BG = "#18191B";
const NBACK_CELL_ACTIVE = "#F7F8F8";

// Grid box: full column width, capped so the square grid plus its answer
// buttons always fit the viewport height.
// Sizing lives in index.css (.nback-box) rather than here, because it has
// to differ between the side-by-side desktop layout and the stacked one.


// ---------------------------------------------------------------------
// LETTER AUDIO
// ---------------------------------------------------------------------
// Recorded letter voices, with browser text-to-speech as the fallback.
//
// TO ADD THE FILES: drop one file per letter into `public/audio/letters/`,
// named for the letter in uppercase — A.mp3, K.mp3, L.mp3, and so on, one for
// every entry in LETTERS. Vite serves `public/` from the site root, so
// `public/audio/letters/K.mp3` is fetched as `/audio/letters/K.mp3`; no import
// or build step is involved. Anything missing falls back to speech synthesis
// on its own, so a partial set still runs.
//
// Trim the files tight — leading silence is dead time the app can't see, and
// at a 500ms stimulus window even 100ms of it shifts the letter noticeably
// later than the visual it's meant to accompany.
const LETTER_AUDIO_BASE = "/audio/letters/";
const letterAudioBuffers = new Map(); // letter -> decoded AudioBuffer
let letterAudioCtx = null;
let letterAudioGain = null;
let letterAudioSource = null; // the one currently playing, so it can be cut off

function letterAudioContext() {
  if (letterAudioCtx) return letterAudioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  letterAudioCtx = new Ctx();
  letterAudioGain = letterAudioCtx.createGain();
  letterAudioGain.connect(letterAudioCtx.destination);
  // Anything fetched before a context existed can be decoded now.
  if (typeof decodePendingClips === "function") decodePendingClips();
  return letterAudioCtx;
}

// Web Audio rather than <audio> elements: play() on an element carries tens of
// milliseconds of unpredictable latency, which is exactly the kind of jitter
// that makes an audio/visual pair feel out of sync. A decoded buffer starts on
// the next audio frame.
async function preloadLetterAudio() {
  const ctx = letterAudioContext();
  if (!ctx) return;
  await Promise.all(
    LETTERS.map(async (letter) => {
      if (letterAudioBuffers.has(letter)) return;
      try {
        const res = await fetch(`${LETTER_AUDIO_BASE}${letter}.mp3`);
        if (!res.ok) return; // no file for this letter — speech synthesis covers it
        letterAudioBuffers.set(letter, await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch {
        // Network error or an unsupported/corrupt file: leave it unset and let
        // the fallback handle it rather than failing the whole preload.
      }
    })
  );
}

// Browsers won't start audio until the page has had a real user gesture, and a
// context created before one begins life suspended. Called from the Start
// button, which is a gesture by definition.
function unlockLetterAudio() {
  const ctx = letterAudioContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
  preloadLetterAudio();
}

function playLetterSample(letter, onstart) {
  const buffer = letterAudioBuffers.get(letter);
  const ctx = letterAudioCtx;
  if (!buffer || !ctx || ctx.state !== "running") return false;
  // Supersede whatever's still sounding — same rule the speech path follows,
  // so a fast trial never stacks two letters on top of each other.
  if (letterAudioSource) {
    try {
      letterAudioSource.stop();
    } catch {
      // Already finished; stop() on a stopped source throws.
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(letterAudioGain);
  source.onended = () => {
    if (letterAudioSource === source) letterAudioSource = null;
  };
  letterAudioSource = source;
  source.start();
  if (onstart) onstart();
  return true;
}

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
const BUTTON_BASE = "no-sheen bg-slate-700";
const BUTTON_PULSE = "no-sheen bg-emerald-500";

// A visual identity color per exercise, used for card borders/tints,
// leaderboard tab highlights, and header accents so each exercise reads as
// its own thing rather than everything sharing one flat indigo.
// Per-exercise colour, used only on the Home cards for now so the rest of
// the app is untouched while the direction is being judged. Written as hex
// rather than Tailwind classes because these are one-off values that no
// utility covers, and inline styles cannot be missed by a purge.
//
// Chosen to sit apart on the hue wheel so five cards never read as a
// gradient of the same colour, and desaturated enough not to glare on the
// near-black background.
const EXERCISE_COLORS = {
  dual: "#136DEC",      // blue
  quad: "#8A0736",      // maroon
  iqnb: "#7537E2",      // purple
  rrt: "#E58B09",       // orange
  motion3d: "#008000",  // green
  // TODO: pick a colour for CCT when the Anti-brainrot regime is built.
};

// Each regime on the landing page borrows the colour of the exercise that
// defines it: Quick is Dual N-Back, Balanced leads with RRT, Deep is built
// around QNB'.
const REGIME_COLORS = {
  low: EXERCISE_COLORS.motion3d,
  medium: EXERCISE_COLORS.rrt,
  high: EXERCISE_COLORS.iqnb,
};

// The cards need four values from one hex: a faint fill, a visible border,
// a solid dot, and text bright enough to read. Derived rather than listed
// so adding an exercise means adding one colour, not four.
// The colour laid over the page's own
// near-black rather than at full strength, for large surfaces where a
// button-brightness fill is too much.
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function exerciseDeepFill(hex) {
  const { h, s, l } = hexToHsl(hex);
  // This used to mix toward near-black by a fixed ratio, which pushed the
  // hues that sit lower in HSL lightness (orange, green) much darker than
  // purple and blue. Capping lightness instead, with hue and saturation
  // untouched, lands every card at the same weight.
  const cap = Math.min(l, 0.44);
  const css = (lightness) =>
    `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(lightness * 100).toFixed(1)}%)`;
  return `linear-gradient(100deg, ${css(cap)}, ${css(cap * 0.76)})`;
}

// The gem's shadow, in the card's own hue rather than black. A flat black
// shadow reads far heavier on the hues that carry more luminance at the same
// HSL lightness (orange, green) than on purple or blue; shading the card's
// own colour down by a fixed proportion keeps the depth looking equal
// whatever the card underneath is.
function exerciseShadowColor(hex, alpha) {
  const { h, s } = hexToHsl(hex);
  const { l } = hexToHsl(hex);
  const base = Math.min(l, 0.44) * 0.3;
  return `hsl(${h.toFixed(1)} ${(s * 60).toFixed(1)}% ${(base * 100).toFixed(1)}% / ${alpha})`;
}

// A shadow colour for content sitting on a deep-fill card: the card's hue
// taken most of the way to black, so the shadow belongs to the surface
// instead of being a flat black patch whose weight changes with the fill.
function exerciseShadow(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${Math.round(((n >> 16) & 255) * 0.12)}, ${Math.round(
    ((n >> 8) & 255) * 0.12
  )}, ${Math.round((n & 255) * 0.12)}, 0.55)`;
}

function exerciseTint(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const ACCENT_STYLES = {
  indigo: {
    border: "border-indigo-500/40",
    borderStrong: "border-indigo-400",
    hoverBorderStrong: "hover:border-slate-500",
    bg: "bg-indigo-500/10",
    text: "text-indigo-300",
    dot: "bg-indigo-400",
    grad: "from-indigo-500 to-violet-500",
  },
  violet: {
    border: "border-violet-500/40",
    borderStrong: "border-violet-400",
    hoverBorderStrong: "hover:border-slate-500",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
    dot: "bg-violet-400",
    grad: "from-violet-500 to-fuchsia-500",
  },
  amber: {
    border: "border-amber-500/40",
    borderStrong: "border-amber-400",
    hoverBorderStrong: "hover:border-slate-500",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    dot: "bg-amber-400",
    grad: "from-amber-500 to-orange-500",
  },
  cyan: {
    border: "border-cyan-500/40",
    borderStrong: "border-cyan-400",
    hoverBorderStrong: "hover:border-slate-500",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    dot: "bg-cyan-400",
    grad: "from-cyan-500 to-sky-500",
  },
  rose: {
    border: "border-rose-500/40",
    borderStrong: "border-rose-400",
    hoverBorderStrong: "hover:border-slate-500",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    dot: "bg-rose-400",
    grad: "from-rose-500 to-pink-500",
  },
  lime: {
    border: "border-lime-500/40",
    borderStrong: "border-lime-400",
    hoverBorderStrong: "hover:border-slate-500",
    bg: "bg-lime-500/10",
    text: "text-lime-300",
    dot: "bg-lime-400",
    grad: "from-lime-500 to-lime-400",
  },
  emerald: {
    border: "border-emerald-500/40",
    borderStrong: "border-emerald-400",
    hoverBorderStrong: "hover:border-slate-500",
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
    accent: "indigo",
    modalities: ["pos", "audio", "color", "shape"],
    maxN: 10,
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
    accent: "indigo",
    modalities: [],
    maxN: 10, // level = premise count, so level 10 = 10p — the ceiling for RRT's own achievements/gem tiers
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
    accent: "indigo",
    modalities: ["pos", "audio", "color", "shape"],
    maxN: 10,
    defaultN: 4,
    stimMs: 2500, // overridden per-run from qnbPrimeSettingsFor once a session starts
    comingSoon: false,
    scoreType: "decimal",
    description:
      "Same as Quad N-Back, but the color/shape stream renders as a Voronoi-textured blob instead of a flat-colored shape, and difficulty ramps in fine 0.01 increments instead of whole levels.",
  },
  motion3d: {
    key: "motion3d",
    title: "3D MOT",
    abbrev: "3D",
    accent: "indigo",
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
    subtitle: "15 min",
    summary: "3D MOT",
    accent: "indigo",
    steps: [{ key: "motion3d", minutes: 15 }],
  },
  {
    key: "medium",
    title: "Balanced",
    subtitle: "45 min",
    summary: "RRT · QNB' · 3D MOT",
    accent: "indigo",
    steps: [
      { key: "rrt", minutes: 10 },
      { key: "iqnb", minutes: 20 },
      { key: "motion3d", minutes: 15 },
    ],
  },
  {
    key: "high",
    title: "Deep",
    subtitle: "75 min",
    summary: "RRT · Dual N-Back · QNB' · Quad N-Back",
    accent: "indigo",
    steps: [
      { key: "rrt", minutes: 10 },
      { key: "dual", minutes: 25 },
      { key: "iqnb", minutes: 20 },
      { key: "quad", minutes: 20 },
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
  // A recorded voice wins when there's a file for this letter; everything
  // below is the fallback for letters with no recording, and for before the
  // preload finishes.
  if (playLetterSample(letter, onstart)) return;
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
// Version tag on the URL. Before the track existed, requests for this path
// fell through to the SPA rewrite and came back as index.html with a 200,
// which browsers cache — and a cached HTML body under an audio src fails to
// decode forever after. Bumping this string sidesteps any such stale entry.
const BACKGROUND_MUSIC_CACHE_TAG = "v1";
const BINAURAL_VOLUME = 0.2205; // background listening level
function useBinauralBeats(enabled) {
  const audioRef = useRef(null);
  const fadeRafRef = useRef(null);
  const playPromiseRef = useRef(null);
  const settleRef = useRef(null);
  const [audioError, setAudioError] = useState(null);

  const describe = (audio) => {
    const codes = {
      1: "playback aborted",
      2: "network error fetching the track",
      3: "the track could not be decoded",
      4: "the track was not found or is not a supported format",
    };
    if (audio && audio.error) return codes[audio.error.code] || "audio element error";
    return null;
  };

  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(
      `${BACKGROUND_MUSIC_SRC}?${BACKGROUND_MUSIC_CACHE_TAG}`
    );
    audio.loop = true;
    audio.volume = 0;
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      const msg = describe(audio) || "the track failed to load";
      setAudioError(msg);
      logClientError(`binaural: ${msg}`);
    });
    audioRef.current = audio;
    return audio;
  };

  // Start the element inside the tap that turned the toggle on. Autoplay
  // policy grants an element permission the first time play() is called from
  // a real gesture, and that permission sticks for the element's lifetime —
  // which is what lets the exercise start it later without a second tap.
  const unlock = () => {
    setAudioError(null);
    const audio = ensureAudio();
    const p = audio.play();
    playPromiseRef.current = p;
    if (p && p.catch) {
      p.catch((err) => {
        // An interrupted play (we paused it again straight away) is normal
        // and not worth showing.
        if (err && err.name === "AbortError") return;
        setAudioError(`${err.name}: ${err.message}`);
        logClientError(`binaural play: ${err.name}: ${err.message}`);
      });
    }
  };

  useEffect(() => {
    if (!audioRef.current) {
      if (!enabled) return undefined;
      unlock();
    }
    const audio = audioRef.current;
    if (!audio) return undefined;

    const fadeTo = (target, durationMs) => {
      cancelAnimationFrame(fadeRafRef.current);
      const start = audio.volume;
      const startTime = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        audio.volume = Math.max(0, Math.min(1, start + (target - start) * t));
        if (t < 1) {
          fadeRafRef.current = requestAnimationFrame(step);
        } else if (target === 0) {
          // Only ever pause once the play() that started it has settled;
          // pausing a pending play() throws and, worse, can leave the
          // element in a state where the next play() never resolves.
          Promise.resolve(playPromiseRef.current)
            .catch(() => {})
            .then(() => {
              if (audioRef.current === audio && audio.volume === 0) audio.pause();
            });
        }
      };
      fadeRafRef.current = requestAnimationFrame(step);
    };

    if (enabled) {
      const p = audio.play();
      playPromiseRef.current = p;
      if (p && p.catch) {
        p.catch((err) => {
          if (err && err.name === "AbortError") return;
          setAudioError(`${err.name}: ${err.message}`);
          logClientError(`binaural play: ${err.name}: ${err.message}`);
        });
      }
      fadeTo(BINAURAL_VOLUME, 1200);
      // Belt and braces. The fade is an animation-frame loop, and anything
      // that stops that loop early (a thrown frame, a throttled tab) would
      // leave the track playing at whatever volume it had got to — which,
      // starting from zero, is silence. This lands the volume on target
      // regardless of whether the fade finished.
      settleRef.current = setTimeout(() => {
        if (audioRef.current !== audio) return;
        if (audio.volume < BINAURAL_VOLUME - 0.001) audio.volume = BINAURAL_VOLUME;
        if (audio.paused) {
          const again = audio.play();
          playPromiseRef.current = again;
          if (again && again.catch) again.catch(() => {});
        }
        // Only worth a Diagnostics line when something is actually wrong.
        // This used to log unconditionally, which filled the log with
        // healthy-state notices that read as errors.
        if (audio.paused || audio.error || audio.volume < 0.001) {
          logClientError(
            `binaural stalled: paused=${audio.paused} vol=${audio.volume.toFixed(2)} t=${audio.currentTime.toFixed(1)} ready=${audio.readyState} err=${audio.error ? audio.error.code : "none"}`
          );
        }
      }, 1500);
    } else {
      fadeTo(0, 500);
    }

    return () => {
      cancelAnimationFrame(fadeRafRef.current);
      clearTimeout(settleRef.current);
    };
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

function poolFor(modality, shapeSet) {
  if (modality === "pos") return POSITIONS;
  if (modality === "audio") return LETTERS;
  if (modality === "shape") return shapeSet || SHAPE_TYPES;
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

function generateSequence(
  modalities,
  n,
  length,
  interference = 0,
  matchChance = 0.3,
  shapeSet = null
) {
  const seq = { __n: n };
  modalities.forEach((m) => {
    seq[m] = generateStream(poolFor(m, shapeSet), n, length, interference, matchChance);
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

// The longest run of consecutive training days there has ever been, not just
// the current one. Needed to tell someone the streak they are on is their
// best, which is only worth saying when it is true.
function longestStreakDays(exerciseHistory) {
  const days = new Set();
  Object.values(exerciseHistory).forEach((hist) => {
    (hist || []).forEach((h) => days.add(new Date(h.ts).toDateString()));
  });
  if (days.size === 0) return 0;
  const sorted = Array.from(days)
    .map((d) => new Date(d).setHours(0, 0, 0, 0))
    .sort((a, b) => a - b);
  const DAY = 86400000;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] - sorted[i - 1] === DAY ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

// One line for the session-complete screen: the pool that matches what
// actually happened, or an unconditional line when nothing does. `forcedId`
// shows one specific numbered line, for the test panel.
function sessionNudge(state, forcedId) {
  const forced = forcedId ? MOTIVATION_BY_ID.get(forcedId) : null;
  const from = (cond) => MOTIVATION_LINES.filter((l) => l.cond === cond);

  let pool;
  if (forced) {
    pool = [forced];
  } else if (state?.hitPRToday) {
    pool = from("pr");
  } else if (state?.strongSession === false) {
    pool = from("worse");
  } else if ((state?.streak || 0) === 14) {
    pool = from("streak14");
  } else if (state?.nearBest) {
    pool = from("nearBest");
  } else if ((state?.streak || 0) >= 2) {
    pool = from("streak");
  } else {
    pool = [];
  }
  if (pool.length === 0) pool = MOTIVATION_UNCONDITIONAL;

  const line = pool[Math.floor(Math.random() * pool.length)];
  // `{n}` in a line fills in with the current streak length.
  return (line?.text || "Nice work.").replace("{n}", String(state?.streak ?? 0));
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
const PR_YELLOW = "#F2C200";

// Features built but held back until there are enough users for them to make
// sense. Flip either to true and everything wired to it comes back; nothing
// has been deleted.
const SHOW_LEADERBOARD = false;
const SHOW_PROFILE_CUSTOMIZATION = false;
// Test-only controls that should not ship.
const SHOW_TEST_TOOLS = false;
// Profile pieces that only make sense once other people can see them.
const SHOW_BIO = false;
const SHOW_BADGES = false;
const SHOW_PROFILE_IDENTITY_EDIT = false; // the Account page avatar and name block

// The written lines, numbered to match the shared doc. `cond` is the state
// that can show it; a line with no cond is unconditional and also feeds the
// screen between exercises.
const MOTIVATION_LINES = [
  { id: 1, text: "A sharper mind gives you an edge." },
  { id: 2, text: "Great job! You're getting ahead of the competition." },
  { id: 3, text: "Sharper reactions. Stronger performance." },
  { id: 4, text: "Other people aren't willing to do what you just did. That's why you have an edge." },
  { id: 5, text: "OUTTHINK. OUTREACT. OUTPERFORM." },
  { id: 6, text: "GET AHEAD." },
  { id: 7, text: "MAKE YOUR MIND STRONGER." },
  { id: 8, text: "BECOME MENTALLY SUPERIOR." },
  { id: 9, text: "BECOME MENTALLY UNSTOPPABLE." },
  { id: 10, text: "Another day, another win." },
  { id: 11, text: "Don't worry about being perfect. Just be consistent. The goal is progress, not perfection." },
  { id: 12, text: "Your future self will thank you." },
  { id: 13, text: "You're getting smarter than the competition." },
  { id: 15, text: "14 days straight. Great job. You're nearly at a 30 day streak. Keep it up!", cond: "streak14" },
  { id: 16, text: "Keep going. Your future self will thank you." },
  { id: 17, text: "Be proud of how smart you have become. The best don't stop improving. Become better than your old self." },
  { id: 18, text: "Enjoy being mentally superior to everyone." },
  { id: 19, text: "Other people won't be able to keep up with you." },
  { id: 20, text: "You showed up today. That's a win." },
  { id: 21, text: "Today was a little harder. You still got it done anyway. Good job.", cond: "worse" },
  { id: 22, text: "Another personal best. You're on fire!", cond: "pr" },
  { id: 23, text: "You're right on the edge of a new personal best!", cond: "nearBest" },
  { id: 24, text: "Progress is messy sometimes." },
  { id: 25, text: "It was a hard session but you got it done.", cond: "worse" },
  { id: 26, text: "You're getting stronger with every session." },
  { id: 27, text: "Show up even when you aren't feeling it. That's how winners are made." },
  { id: 28, text: "You're becoming wiser and smarter every session. Keep it up." },
  { id: 29, text: "New personal record! Nice work.", cond: "pr" },
  { id: 30, text: "{n} day streak. Keep it going.", cond: "streak" },
  { id: 31, text: "Some days are hard. Just focus on being consistent.", cond: "worse" },
  { id: 32, text: "Others aren't willing to do what you do. That's why you're better than them." },
  { id: 33, text: "Most people never train this. That's why you have an edge." },
  { id: 34, text: "Your edge is built on days like this." },
  { id: 35, text: "You're building the thing everyone else calls talent." },
  { id: 36, text: "What used to be impossible is now your average. That's how far you've come.", cond: "avgPR" },
  { id: 37, text: "Celebrate this. Then go higher.", cond: "pr" },
  { id: 38, text: "Faster decisions. Better reactions." },
  { id: 39, text: "Become better than your old self." },
  { id: 40, text: "You're on your way to becoming mentally unstoppable." },
  { id: 41, text: "Your opponents aren't ready." },
  { id: 42, text: "The closest thing we have to a superpower is intellect." },
  { id: 43, text: "Dominate everyone." },
  { id: 44, text: "KEEP CLIMBING." },
];
const MOTIVATION_BY_ID = new Map(MOTIVATION_LINES.map((l) => [l.id, l]));
const MOTIVATION_UNCONDITIONAL = MOTIVATION_LINES.filter((l) => !l.cond);

// Shown on the hand-off between exercises. The unconditional lines only:
// anything tied to a streak or a record belongs on the session-complete
// screen, where it can actually be true.
const TRANSITION_QUOTES = MOTIVATION_UNCONDITIONAL.map((l) => l.text);



// Achievement titles read "Quad N-Back Apprentice". Only the rank at the
// end takes the tier colour — colouring the whole line made the exercise
// name look like it belonged to the rank.
function AchievementTitle({ achievement, className, baseColor = "#F7F8F8" }) {
  const { title, tierLabel, tierColor } = achievement || {};
  if (!tierLabel || !tierColor || !title.endsWith(tierLabel)) {
    return (
      <div className={className} style={{ color: baseColor }}>
        {title}
      </div>
    );
  }
  const prefix = title.slice(0, title.length - tierLabel.length);
  return (
    <div className={className} style={{ color: baseColor }}>
      {prefix}
      <span style={{ color: tierColor }}>{tierLabel}</span>
    </div>
  );
}

// Bumped by hand on every change that gets pushed. Shown on the regime
// screen so it is obvious at a glance whether the deploy actually carries
// the latest code, rather than guessing from whether a change "looks"
// applied.
const BUILD_VERSION = 140;
// Local NZ time this version was pushed, set by hand alongside the number.
const BUILD_TIME = "9:56 PM";
// What changed in this version, shown under the stamp on the regime screen.
// One short line each, replaced wholesale every version — this is a "what
// am I looking at" note, not a history.
const BUILD_NOTES = [
  "No loading text on open",
];

// A short synthesized "clink" for button presses. Generated with WebAudio
// rather than shipped as a file: it is a few hundred bytes of code instead
// of an asset, and the pitch and decay can be tuned by editing numbers.
// Currently wired only to the Overview and Stats screens, as a trial.
let clickAudioCtx = null;

// The shared context. Prefers the one the letter audio already runs on,
// which gameplay has unlocked, so a sound never lands on a suspended
// context and silently does nothing.
function uiAudioContext() {
  const ctx = letterAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// A context created before the person has interacted with the page starts
// suspended, and resume() outside a gesture is refused — which silences
// everything, letters included. So: never create one at load, and resume
// the moment a real gesture arrives.
if (typeof window !== "undefined") {
  const unlock = () => {
    // Create the context on the first gesture rather than waiting for
    // gameplay, and decode the celebration track straight away — otherwise
    // the first level-up is the one that has to wait for a 3MB decode.
    const ctx = letterAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    decodePendingClips();
    // Fetch and decode the letter voices on the very first interaction with
    // the page. Waiting until an exercise starts meant the first trial or
    // two fired before the buffers existed and fell back to the browser's
    // own text-to-speech, which is why the first letter sounded different.
    preloadLetterAudio();
  };
  ["pointerdown", "keydown", "touchstart"].forEach((evt) =>
    window.addEventListener(evt, unlock, { capture: true })
  );
}

// Button click. Three layers, which is what separates a designed UI sound
// from a beep: a filtered noise transient for the strike, a low partial for
// body so it has weight rather than only sparkle, and a higher partial for
// definition. Short enough to fire repeatedly without becoming annoying.
function playClick() {
  try {
    const ctx = uiAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);

    // A short filtered noise strike for the attack. Without it the tones
    // alone sound like a notification rather than something being touched.
    const frames = Math.max(1, Math.floor(ctx.sampleRate * 0.012));
    const noiseBuf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const fade = 1 - i / frames;
      data[i] = (Math.random() * 2 - 1) * fade * fade * fade;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 4200;
    bp.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);

    // The sparkle: a bell-like stack rising in quick succession. The
    // intervals are a major triad two octaves up (E6, G#6, B6, E7), so the
    // partials ring together instead of beating, and each one is shorter
    // and quieter than the last so it shimmers away rather than chiming.
    [
      { freq: 1318.5, at: 0, level: 0.55, len: 0.16 },
      { freq: 1661.2, at: 0.026, level: 0.4, len: 0.13 },
      { freq: 1975.5, at: 0.05, level: 0.3, len: 0.11 },
      { freq: 2637, at: 0.078, level: 0.22, len: 0.09 },
    ].forEach(({ freq, at, level, len }) => {
      const start = now + at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + len + 0.02);
    });

    // A little body underneath so it still lands as a press, not just air.
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sine";
    body.frequency.value = 659.25;
    bodyGain.gain.setValueAtTime(0, now);
    bodyGain.gain.linearRampToValueAtTime(0.5, now + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(master);
    body.start(now);
    body.stop(now + 0.1);
  } catch {
    // No audio available; a missing click is not worth surfacing.
  }
}

// Applause, from a recording.
//
// TO ADD THE FILE: drop it at `public/audio/cheer.mp3`. Vite serves
// `public/` from the site root, so it is fetched as `/audio/cheer.mp3` —
// no import and no build step. If the file is absent nothing plays and the
// rest of the app is unaffected, so it can be added or swapped any time.
//
// The clip is faded in over its first stretch and held below full: applause
// arriving at full volume on the first frame is startling, and this plays
// right after a run when someone has headphones on.
const CHEER_URL = "/audio/cheer.mp3";
const CHEER_PEAK = 0.34; // never louder than this, whatever the file's own level
const CHEER_FADE_IN = 0.45; // seconds
let cheerBuffer = null; // decoded clip
let cheerLoadStarted = false;
let cheerBytes = null;

// Fetching needs no audio context, so it happens at load. Decoding does, so
// it waits until there is one — creating a context here would create it
// suspended and take the rest of the app's audio down with it.
// The card press. A struck-metal tap: a very short bright transient, then
// a stack of INHARMONIC partials ringing above it. Harmonic ratios (2x, 3x)
// sound like a pitched instrument; the ratios below are the ones a struck
// bar or bell actually produces, and they are what the ear hears as metal.
function playShine() {
  try {
    const ctx = uiAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.15;
    // Rolls off everything below the strike so it stays bright and small
    // rather than thudding.
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    master.connect(hp);
    hp.connect(ctx.destination);

    // The contact itself: a few milliseconds of noise, gone almost before
    // it registers. Without it the partials sound blown rather than struck.
    const frames = Math.max(1, Math.floor(ctx.sampleRate * 0.02));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 5200;
    bp.Q.value = 1.1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.9;
    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);

    // Struck-bar ratios. Everything lands at once, as a strike does, and
    // the higher partials die first so the tap brightens then thins out.
    const base = 1180;
    [
      { r: 1, level: 0.5, len: 0.62 },
      { r: 2.756, level: 0.34, len: 0.42 },
      { r: 5.404, level: 0.24, len: 0.3 },
      { r: 8.933, level: 0.16, len: 0.21 },
      { r: 13.34, level: 0.1, len: 0.14 },
      { r: 3.932, level: 0.18, len: 0.34 },
    ].forEach(({ r, level, len }) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      // A hair of detune per partial so it shimmers instead of sitting
      // dead still, the way a real bar never rings perfectly pure.
      osc.frequency.setValueAtTime(base * r * (1 + (Math.random() - 0.5) * 0.006), now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(level, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + len);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + len + 0.05);
    });
  } catch (err) {
    // Audio is a nicety here; a failure must never break the press.
  }
}

function preloadCheer() {
  if (cheerLoadStarted) return;
  cheerLoadStarted = true;
  fetch(CHEER_URL)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error("no file"))))
    .then((buf) => {
      cheerBytes = buf;
      const ctx = letterAudioCtx;
      if (ctx) return ctx.decodeAudioData(buf.slice(0)).then((d) => (cheerBuffer = d));
      return null;
    })
    .catch(() => {
      // No clip present. Nothing to do.
    });
}

function playCheer() {
  try {
    const ctx = uiAudioContext();
    if (!ctx) return;
    if (!cheerBuffer) {
      // Bytes may be in hand with no context to decode them at the time.
      if (cheerBytes) {
        ctx.decodeAudioData(cheerBytes.slice(0)).then((d) => {
          cheerBuffer = d;
        });
      } else {
        preloadCheer();
      }
      return;
    }
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(CHEER_PEAK, now + CHEER_FADE_IN);
    gain.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = cheerBuffer;
    src.connect(gain);
    src.start(now);

    const end = now + cheerBuffer.duration;
    gain.gain.setValueAtTime(CHEER_PEAK, Math.max(now + CHEER_FADE_IN, end - 0.35));
    gain.gain.linearRampToValueAtTime(0.0001, end);
    src.stop(end + 0.05);
  } catch {
    // No audio available; the overlay still says what happened.
  }
}

// Celebration music, from a recording. Only the chorus is used: playback
// starts partway in, fades up, holds, then fades away again.
//
// TO ADD OR REPLACE THE FILE: `public/audio/celebration song.mp3`. The
// space in the name is fine, it just has to be encoded in the URL below.
const SONG_URL = "/audio/celebration%20song.mp3";
const SONG_START = 56; // seconds into the track
const SONG_FADE_OUT_AT = 74; // seconds into the track
const SONG_FADE_IN = 2.6; // seconds
const SONG_FADE_OUT = 7; // seconds
const SONG_PEAK = 0.08;
let songBuffer = null;
let songLoadStarted = false;
let songSource = null; // the one currently playing, so a second level-up cuts the first
// Frequency data for the on-screen visualiser. Lives at module scope so the
// component can pick it up without the audio code knowing anything about React.
let songAnalyser = null;
let songGain = null; // so a dismissal can fade the track out early
function getSongAnalyser() {
  return songAnalyser;
}
let songBytes = null;
let songFailed = false;
let songWantedAt = 0; // when a level-up asked for it but it was not ready yet

// Called the moment a context comes into being, for clips whose bytes
// arrived first.
function decodePendingClips() {
  const ctx = letterAudioCtx;
  if (!ctx) return;
  if (cheerBytes && !cheerBuffer) {
    ctx.decodeAudioData(cheerBytes.slice(0)).then(
      (d) => {
        cheerBuffer = d;
      },
      () => {}
    );
  }
  decodeSong();
}

function preloadSong() {
  if (songLoadStarted) return;
  songLoadStarted = true;
  fetch(SONG_URL)
    .then((res) =>
      res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))
    )
    .then((buf) => {
      songBytes = buf;
      return decodeSong();
    })
    .catch((err) => {
      songFailed = true;
      logClientError("celebration song failed to load", err);
    });
}

// Decoding needs a context, which may not exist when the bytes arrive. This
// is called both on arrival and the moment a context is created.
function decodeSong() {
  const ctx = letterAudioCtx;
  if (!ctx || !songBytes || songBuffer) return Promise.resolve(null);
  return ctx
    .decodeAudioData(songBytes.slice(0))
    .then((decoded) => {
      songBuffer = decoded;
      if (songWantedAt && Date.now() - songWantedAt < 8000) {
        songWantedAt = 0;
        playCelebrationSong();
      }
      return decoded;
    })
    .catch((err) => {
      songFailed = true;
      logClientError("celebration song failed to decode", err);
      return null;
    });
}

function playCelebrationSong() {
  const ctx = uiAudioContext();
  if (!ctx) return false;
  if (!songBuffer) {
    // Remember that it was wanted, so it still plays a moment later once
    // decoding finishes, instead of being dropped.
    songWantedAt = Date.now();
    if (songBytes) decodeSong();
    else preloadSong();
    return false;
  }
  try {
    // Two level-ups in quick succession should not stack.
    if (songSource) {
      try {
        songSource.stop();
      } catch {
        // Already finished.
      }
      songSource = null;
    }
    const now = ctx.currentTime;
    const playFor = Math.max(
      0,
      Math.min(songBuffer.duration, SONG_FADE_OUT_AT) - SONG_START
    );
    if (playFor <= 0) return false;

    const gain = ctx.createGain();
    songGain = gain;
    // Starts at a fraction of full rather than at silence. An exponential
    // ramp from near-zero spends most of its length inaudible, which reads
    // as the music being late rather than fading in.
    gain.gain.setValueAtTime(SONG_PEAK * 0.01, now);
    gain.gain.exponentialRampToValueAtTime(SONG_PEAK * 0.35, now + SONG_FADE_IN * 0.4);
    gain.gain.exponentialRampToValueAtTime(SONG_PEAK, now + SONG_FADE_IN);
    // Hold until the fade-out point, then ease down to silence.
    gain.gain.setValueAtTime(SONG_PEAK, now + playFor);
    gain.gain.exponentialRampToValueAtTime(
      SONG_PEAK * 0.06,
      now + playFor + SONG_FADE_OUT * 0.75
    );
    gain.gain.linearRampToValueAtTime(0.0001, now + playFor + SONG_FADE_OUT);

    // The analyser hangs off the SOURCE, not off the gain. Downstream of the
    // gain it was reading the fade envelope as well as the music: the track
    // climbs 60dB over the fade-in and drops away again at the end, which
    // swamped the music's own dynamics and is why the glow moved at times
    // that had nothing to do with what was playing. An analyser needs no
    // output connection to work, so this is a pure tap on the raw track.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    // The byte data is a dB mapping between these bounds. Reading the raw
    // track rather than the faded one, the levels are those of a mastered
    // mix, so the window sits accordingly.
    analyser.minDecibels = -60;
    analyser.maxDecibels = -12;
    // Zero. Every bit of smoothing here is latency on the attack, and the
    // decay is handled in the animation instead, where it can be applied
    // after the trigger rather than before it.
    analyser.smoothingTimeConstant = 0;
    gain.connect(ctx.destination);
    songAnalyser = analyser;

    const src = ctx.createBufferSource();
    src.buffer = songBuffer;
    src.connect(gain);
    src.connect(analyser);
    // Offset playback into the track rather than trimming the file.
    src.start(now, SONG_START);
    src.stop(now + playFor + SONG_FADE_OUT + 0.05);
    src.onended = () => {
      if (songSource === src) songSource = null;
      if (songAnalyser === analyser) songAnalyser = null;
      if (songGain === gain) songGain = null;
    };
    songSource = src;
    return true;
  } catch {
    return false;
  }
}

// End of a session. A settled two-note fall — the opposite shape to the
// level-up rise, so finishing reads as completion rather than as another
// reward. Quiet, and over in under a second and a half.
function playSessionDone() {
  try {
    const ctx = uiAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.11;
    master.connect(ctx.destination);

    // G5 down to C5: a perfect fourth resolving to the tonic, which is the
    // most settled two notes there are.
    [
      { freq: 783.99, at: 0, len: 0.7 },
      { freq: 523.25, at: 0.22, len: 1.2 },
    ].forEach(({ freq, at, len }, i) => {
      const start = now + at;
      [
        { type: "triangle", mult: 1, level: 0.7 },
        { type: "sine", mult: 2, level: 0.12 },
      ].forEach(({ type, mult, level }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq * mult;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level * (i === 1 ? 1 : 0.8), start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + len + 0.05);
      });
    });
  } catch {
    // No audio available; the animation still plays.
  }
}

// A spectrum drawn from whatever the celebration track is doing right now.
// Bars run outward from the centre in both directions, low frequencies in
// the middle where the energy is, mirrored top and bottom so the screen
// reads as a band rather than a chart. Pure canvas: 64 bars a frame is
// nothing, and it costs no DOM.
// The record screen's backdrop. A still gold bloom: it comes up with the
// reveal, holds, and goes out on the song's fade. Nothing about it moves in
// between, because anything that did read as drifting rather than as light.
function PrGoldGlow({ className, style, out }) {
  // Two layers. The outer one owns the reveal fade and the fade-out at the
  // end, both slow transitions on opacity; the inner one carries the breathe.
  // One element cannot do both, since the animation would fight the
  // transition for the same property.
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        ...style,
        opacity: out ? 0 : style?.opacity,
        transition: out
          ? `opacity ${SONG_FADE_OUT}s linear`
          : style?.transition,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          willChange: "opacity",
          // Strong enough to actually read on the near-black backdrop.
          background: `radial-gradient(56% 44% at 50% 46%, ${PR_YELLOW}85 0%, ${PR_YELLOW}4D 28%, ${PR_YELLOW}1F 52%, transparent 76%)`,
        }}
      />
    </div>
  );
}

function SongVisualizer({ className, style }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return undefined;
    let frame = 0;
    let data = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const BARS = 40;
    // Kept as bands even though nothing draws them individually: the glow
    // responds to the low end specifically, and reading that from real
    // frequency bands is what makes it move with the music rather than with
    // overall loudness.
    const peaks = new Array(BARS).fill(0.12);
    const levels = new Array(BARS).fill(0);

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx2d.clearRect(0, 0, w, h);
      const analyser = getSongAnalyser();
      if (!analyser) return;
      if (!data || data.length !== analyser.frequencyBinCount) {
        data = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(data);

      const nyquist = (analyser.context.sampleRate || 44100) / 2;
      const binHz = nyquist / data.length;
      const F_LOW = 40;
      const F_HIGH = 14000;
      const ratio = F_HIGH / F_LOW;

      let energy = 0;
      let bass = 0;
      const bassBands = Math.max(1, Math.floor(BARS * 0.2));

      for (let i = 0; i < BARS; i++) {
        const f0 = F_LOW * Math.pow(ratio, i / BARS);
        const f1 = F_LOW * Math.pow(ratio, (i + 1) / BARS);
        const b0 = Math.max(0, Math.floor(f0 / binHz));
        const b1 = Math.min(data.length - 1, Math.max(b0 + 1, Math.ceil(f1 / binHz)));

        let sum = 0;
        let top = 0;
        for (let b = b0; b <= b1; b++) {
          sum += data[b];
          if (data[b] > top) top = data[b];
        }
        const mean = sum / (b1 - b0 + 1);
        const raw = (top * 0.7 + mean * 0.3) / 255;

        peaks[i] = Math.max(raw, peaks[i] * 0.9993);
        const t0 = i / BARS;
        const tilt = 1 + t0 * 3.2;
        const gated = Math.max(0, raw * tilt - 0.05);
        const norm = Math.min(1, gated / Math.max(0.1, peaks[i] * tilt));

        const target = Math.pow(norm, 0.85);
        levels[i] =
          target > levels[i]
            ? levels[i] + (target - levels[i]) * 0.85
            : levels[i] + (target - levels[i]) * 0.09;

        energy += levels[i];
        if (i < bassBands) bass += levels[i];
      }

      energy /= BARS;
      bass /= bassBands;

      // Two blooms: a wide one over the whole screen breathing with overall
      // energy, and a stronger one low down that pumps with the bass.
      const wide = ctx2d.createRadialGradient(
        w / 2,
        h * 0.62,
        0,
        w / 2,
        h * 0.62,
        Math.max(w, h) * (0.45 + energy * 0.3)
      );
      wide.addColorStop(0, `rgba(242, 194, 0, ${(0.02 + energy * 0.05).toFixed(3)})`);
      wide.addColorStop(1, "rgba(242, 194, 0, 0)");
      ctx2d.globalCompositeOperation = "lighter";
      ctx2d.fillStyle = wide;
      ctx2d.fillRect(0, 0, w, h);

      const low = ctx2d.createRadialGradient(
        w / 2,
        h * 0.95,
        0,
        w / 2,
        h * 0.95,
        Math.max(260, w * 0.55 * (0.5 + bass * 0.8))
      );
      low.addColorStop(0, `rgba(242, 194, 0, ${(0.04 + bass * 0.12).toFixed(3)})`);
      low.addColorStop(1, "rgba(242, 194, 0, 0)");
      ctx2d.fillStyle = low;
      ctx2d.fillRect(0, 0, w, h);
      ctx2d.globalCompositeOperation = "source-over";
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvasRef} className={className} style={style} />;
}

// Brings the track down early — when someone dismisses the screen the music
// should follow them out rather than being cut mid-bar or left playing over
// whatever they do next.
function fadeOutCelebrationSong(seconds = 3) {
  const ctx = letterAudioCtx;
  if (!ctx || !songGain || !songSource) return;
  try {
    const now = ctx.currentTime;
    const g = songGain.gain;
    // Cancel the scheduled hold/fade and ramp from wherever it is now.
    const from = Math.max(g.value, 0.0001);
    g.cancelScheduledValues(now);
    g.setValueAtTime(from, now);
    // Down to a whisper over most of it, then out — the same shape as the
    // natural ending, rather than a straight drop.
    g.exponentialRampToValueAtTime(from * 0.08, now + seconds * 0.7);
    g.linearRampToValueAtTime(0.0001, now + seconds);
    songSource.stop(now + seconds + 0.05);
  } catch {
    // Already stopped.
  }
}

// Level-up flourish. A rising major triad — root, third, fifth, then the
// octave — on soft triangle waves, each note fading into the next. Written
// out as oscillators rather than shipped as a file, so there is no licence
// attached to it and nothing to attribute. Deliberately quiet: it plays on
// top of the level-up overlay, which is already carrying the moment.
let lastLevelUpAt = 0;
function playLevelUp() {
  try {
    // Two callers can legitimately fire on the same moment — finishing a
    // session queues an achievement check, and the achievement effect plays
    // this too — so the tune came out twice, stacked and louder. One is
    // enough; anything inside a quarter second of the last is the same
    // event arriving by a second route.
    const t = Date.now();
    if (t - lastLevelUpAt < 120) return;
    lastLevelUpAt = t;
    const ctx = uiAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.1;
    master.connect(ctx.destination);

    // C5 E5 G5 E6. Landing on the third an octave and a half up rather than
    // on the root: the root is where a phrase comes to rest, the third is
    // where it opens out, which is why this version lifts. It also rings
    // longest, so it reads as an arrival rather than a sequence that simply
    // stopped.
    const notes = [
      { freq: 523.25, at: 0, len: 0.5 },
      { freq: 659.25, at: 0.075, len: 0.5 },
      { freq: 783.99, at: 0.15, len: 0.55 },
      { freq: 1318.51, at: 0.235, len: 1.05 },
    ];
    notes.forEach(({ freq, at, len }, i) => {
      const start = now + at;
      // Each note is a triangle plus a quiet sine an octave up: the triangle
      // gives it body, the sine keeps it from sounding muffled.
      [
        { type: "triangle", mult: 1, level: 1 },
        { type: "sine", mult: 2, level: 0.16 },
      ].forEach(({ type, mult, level }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq * mult;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level * (i === 3 ? 0.85 : 0.6), start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + len + 0.05);
      });
    });
  } catch {
    // No audio available; a silent level-up is still a level-up.
  }
}

// The number the graphs and the Score column actually plot: the LEVEL
// reached, not the hit rate. N-back exercises carry that in `n`; QNB' and
// 3D MOT store their own float level in `accuracy`; RRT stores points and
// seconds packed into one float.
function sessionLevel(exercise, entry) {
  if (!entry || entry.accuracy == null) return null;
  return exercise.scoreType === "accuracy" ? entry.n ?? null : entry.accuracy;
}

// Short form for a Y-axis tick — full labels are far too wide stacked down
// the side of a chart.
function formatLevelTick(exercise, value) {
  if (value == null || Number.isNaN(value)) return "";
  switch (exercise.scoreType) {
    case "points":
      return `${Math.floor(value)}p`;
    case "decimal":
      return value.toFixed(2);
    default:
      return `${Math.round(value)}B`;
  }
}

// RRT's day score reads the same way it does everywhere else in the app:
// premises solved, round length, then the run of correct answers out of 20.
function formatScoreCell(exercise, row) {
  if (row.level == null) return "—";
  if (exercise.scoreType === "points") {
    return `${formatScoreValue(exercise, row.level)} ${row.streak ?? 0}/20`;
  }
  return formatLevelValue(exercise, row.level);
}

// Full form, used in tooltips and the table.
function formatLevelValue(exercise, value) {
  if (value == null || Number.isNaN(value)) return "—";
  switch (exercise.scoreType) {
    case "points":
      return formatScoreValue(exercise, value);
    case "decimal":
      return `${exercise.abbrev} ${value.toFixed(2)}`;
    default:
      return `${exercise.abbrev}${Math.round(value)}B`;
  }
}

// Collapses a long history into a readable number of points. Under the
// session threshold every session is its own point; past it they group by
// week, and past a year by month. Each bucket reports the best level reached
// in it with the mean underneath, so the shape of years of training stays
// legible instead of turning into a solid band of noise.
function bucketKeyFor(ts, grain) {
  const d = new Date(ts);
  if (grain === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  // Week starting Monday.
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return `w${d.getTime()}`;
}

function bucketLabel(ts, grain) {
  const d = new Date(ts);
  if (grain === "month") {
    return `${d.toLocaleDateString(undefined, { month: "short" })} ${String(
      d.getFullYear()
    ).slice(2)}`;
  }
  return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: "short" })}`;
}

function aggregateSessions(sessions, grain) {
  if (grain === "session") return sessions;
  const buckets = new Map();
  sessions.forEach((sn) => {
    if (sn.level == null) return;
    const key = bucketKeyFor(sn.ts, grain);
    const b = buckets.get(key) || { ts: sn.ts, sum: 0, count: 0, best: null };
    b.ts = Math.min(b.ts, sn.ts);
    b.sum += sn.level;
    b.count += 1;
    b.best = b.best === null ? sn.level : Math.max(b.best, sn.level);
    buckets.set(key, b);
  });
  const filled = Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);

  // Periods with no training are kept as empty points rather than skipped.
  // Without them the line joins August straight onto October as though the
  // gap never happened; with them it breaks, which is the truth.
  const withGaps = [];
  filled.forEach((b, i) => {
    if (i > 0) {
      const cursor = new Date(filled[i - 1].ts);
      for (let guard = 0; guard < 600; guard++) {
        if (grain === "month") cursor.setMonth(cursor.getMonth() + 1);
        else cursor.setDate(cursor.getDate() + 7);
        if (bucketKeyFor(cursor.getTime(), grain) === bucketKeyFor(b.ts, grain)) break;
        if (cursor.getTime() >= b.ts) break;
        withGaps.push({
          ts: cursor.getTime(),
          label: bucketLabel(cursor.getTime(), grain),
          level: null,
          avg: null,
          sessions: 0,
        });
      }
    }
    withGaps.push({
      ts: b.ts,
      label: bucketLabel(b.ts, grain),
      level: b.best,
      avg: b.sum / b.count,
      sessions: b.count,
    });
  });
  return withGaps.map((b, i) => ({ ...b, session: i + 1 }));
}

// Table records, walked oldest to newest: a day sets a score record when its
// best level beats every earlier day, and an average record when that day's
// mean level beats every earlier day's. They move independently — a single
// blinding session can set a score PR on an otherwise mediocre day, and a
// consistent day can set an average PR without any single standout run.
function markDayRecords(list) {
  let bestScore = null;
  let bestAvg = null;
  return list.map((item) => {
    const isPR = item.level != null && bestScore !== null && item.level > bestScore;
    if (item.level != null && (bestScore === null || item.level > bestScore)) {
      bestScore = item.level;
    }
    const isAvgPR = item.dayAvg != null && bestAvg !== null && item.dayAvg > bestAvg;
    if (item.dayAvg != null && (bestAvg === null || item.dayAvg > bestAvg)) {
      bestAvg = item.dayAvg;
    }
    return { ...item, isPR, isAvgPR };
  });
}

// Running average of every session up to and including each point, plus a
// flag for the sessions where that average reached a new high. Both the
// score and the average can set a record, and they set them independently.
function withRunningAverage(list) {
  let sum = 0;
  let count = 0;
  let bestAvg = null;
  let bestScore = null;
  return list.map((item) => {
    if (item.level == null) {
      // A gap point. The average line breaks with the score line rather than
      // carrying the old running average across months of no training.
      return { ...item, avg: null, isPR: false, isAvgPR: false };
    }
    const isPR = bestScore !== null && item.level > bestScore;
    if (bestScore === null || item.level > bestScore) bestScore = item.level;
    sum += item.level;
    count += 1;
    const avg = sum / count;
    const isAvgPR = bestAvg !== null && avg > bestAvg;
    if (bestAvg === null || avg > bestAvg) bestAvg = avg;
    return { ...item, avg, isPR, isAvgPR };
  });
}

// Recharts hands every point through here. Ordinary sessions get the small
// exercise-coloured dot they always had; a personal best gets a yellow ring
// around a yellow core, which reads at a glance without adding a label to
// every peak and cluttering the line.
function renderPRDot(props, color) {
  const { cx, cy, payload, index } = props;
  if (cx == null || cy == null) return null;
  if (!payload || !payload.isPR) {
    return (
      <circle key={`d${index}`} cx={cx} cy={cy} r={3} fill={color} />
    );
  }
  return (
    <g key={`pr${index}`}>
      <circle cx={cx} cy={cy} r={7} fill={PR_YELLOW} fillOpacity={0.18} />
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="none"
        stroke={PR_YELLOW}
        strokeWidth={1.75}
      />
      <circle cx={cx} cy={cy} r={2.5} fill={PR_YELLOW} />
    </g>
  );
}

function buildExerciseDailyRows(entries, exercise) {
  const dayMap = new Map();
  (entries || []).forEach((h) => {
    const dateKey = new Date(h.ts).toDateString();
    const prev = dayMap.get(dateKey) || {
      durationMs: 0,
      accuracy: null,
      n: null,
      streak: null,
      lastTs: 0,
      ts: h.ts,
      levelSum: 0,
      levelCount: 0,
    };
    dayMap.set(dateKey, {
      dateKey,
      ts: Math.max(prev.ts, h.ts),
      durationMs: prev.durationMs + (h.durationMs || 0),
      accuracy: h.ts >= prev.lastTs ? h.accuracy : prev.accuracy,
      n: h.ts >= prev.lastTs ? h.n : prev.n,
      streak: h.ts >= prev.lastTs ? h.streak ?? prev.streak : prev.streak,
      lastTs: Math.max(prev.lastTs, h.ts),
      // The day's own average level, across however many sessions were run
      // that day — not a running total. "Best average" then means the best
      // day, which is a record worth flagging, instead of a number that
      // creeps up on almost every row while someone is improving.
      levelSum: prev.levelSum + (exercise ? sessionLevel(exercise, h) ?? 0 : 0),
      levelCount: prev.levelCount + (sessionLevel(exercise, h) == null ? 0 : 1),
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
      rows.push({
        ...existing,
        dayAvg: existing.levelCount ? existing.levelSum / existing.levelCount : null,
        missed: false,
      });
    } else {
      rows.push({
        dateKey,
        ts: cursor.getTime(),
        durationMs: 0,
        accuracy: null,
        n: null,
        streak: null,
        dayAvg: null,
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
// Exact green/red from the reference build, used for every correct/wrong
// signal in RRT — the flash over the puzzle box, the history verdicts, and the
// TRUE/FALSE answer values — so the exercise reads as one system instead of
// three different greens.
const RRT_GREEN = "#1E982B";
const RRT_RED = "#971426";
const RRT_TIMEOUT = "#8A8F98";

// How scrambled the premise viewing order is. Fixed rather than adjustable:
// this is the difficulty the exercise is tuned around, and letting it vary
// made two runs at the same level not comparable.
const RRT_SCRAMBLE_FACTOR = 0.8;

// Whether the "tick this to start" pointer has been dismissed for good.
// Bumped: earlier builds had a version of this that could be dismissed by
// accident, and a stale "hidden" flag meant the pointer never appeared for
// someone who had never actually seen it.
const RRT_TIMER_HINT_KEY = "cortex.rrtTimerHint.v6";
const RRT_HISTORY_HINT_KEY = "cortex.rrtHistoryHint.v4";
// Whether a round has ever been answered, so the History pointer survives a
// remount of the exercise rather than resetting with component state.
const RRT_ANSWERED_KEY = "cortex.rrtAnswered.v1";
const RRT_BACK_HINT_KEY = "cortex.rrtBackHint.v1";

// Interference for every N-back exercise. Fixed rather than adjustable, for
// the same reason as the scramble factor: it is part of what a level means,
// so two runs at the same level have to have faced the same lure rate. QNB'
// is the exception — it derives its own from the level's step table.
const NBACK_INTERFERENCE = 0.125;

const RRT_RELATIONS = ["same as", "opposite of"];

// "contains"/"is within", "more than"/"less than", and "on top of"/"is
// under" are all "order" puzzle TYPES — a directed, transitive relation
// over the same branching tree the distinction puzzle above uses, as
// opposed to distinction's same/opposite equivalence. Unlike distinction
// (where any two items in the tree always resolve to a definite answer),
// two items in an order puzzle can end up with NO provable relation at all
// — see generateRrtOrderPuzzle for why. RRT_ORDER_CONFIGS holds the
// vocabulary/phrasing that's different between contains, comparison, and
// vertical; the actual generation and explanation logic is shared. The
// space2d compass-direction type is deliberately NOT in here — it isn't a
// linear order at all, so it has its own generator and its own explanation
// (a map rather than a chain). See generateRrtSpace2dPuzzle.
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
      "The chain doesn't establish that relation in the direction the conclusion claims, so the honest answer is False.",
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
      "The chain doesn't establish that relation in the direction the conclusion claims, so the honest answer is False.",
  },
  vertical: {
    label: "Linear",
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
      "The chain reverses direction partway through, so neither item is actually established as on top of or under the other, which is why the honest answer is False.",
  },
};
const RRT_PUZZLE_TYPES = ["distinction", "contains", "comparison", "vertical", "space2d"];
const RRT_PUZZLE_TYPE_LABEL = {
  distinction: "Distinction",
  contains: RRT_ORDER_CONFIGS.contains.label,
  comparison: RRT_ORDER_CONFIGS.comparison.label,
  vertical: RRT_ORDER_CONFIGS.vertical.label,
  space2d: "Space 2D",
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
  // Bearings read "is North-East of", so the trailing "of" belongs to the
  // phrase rather than to the sentence template around it.
  if (RRT_SPACE2D_DIRS.some((d) => d.name === relation)) return `is ${relation} of`;
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


// Hues people name differently at a glance — deliberately uneven in degrees,
// because the colour wheel is perceptually uneven. Greens are one wide band
// that needs few samples; blues and purples separate well and get more.
const RRT_IDENTITY_HUES = [0, 28, 50, 88, 140, 172, 196, 220, 248, 278, 306, 334];

const RRT_HUE_NAMES = [
  [15, "Red"],
  [45, "Orange"],
  [70, "Yellow"],
  [95, "Lime"],
  [150, "Green"],
  [185, "Teal"],
  [205, "Cyan"],
  [240, "Blue"],
  [270, "Indigo"],
  [300, "Violet"],
  [330, "Magenta"],
  [360, "Pink"],
];
function rrtHueName(hue) {
  const h = ((hue % 360) + 360) % 360;
  for (const [limit, name] of RRT_HUE_NAMES) if (h < limit) return name;
  return "Red";
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

  // Three kinds in equal thirds — letter tag, square swatch, landscape
  // swatch — then shuffled. Dealing them out rather than rolling per item is
  // what guarantees the mix: independent coin flips regularly produced a
  // chain that was nearly all one kind, which removes a whole dimension the
  // person could otherwise use to keep the items apart.
  const kinds = ["letters", "square", "wide"];
  const types = Array.from({ length: itemCount }, (_, i) => kinds[i % 3]);
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  // Identity colours: random every round, but never two that could be
  // confused.
  //
  // Spacing hues evenly in degrees doesn't work — the wheel isn't
  // perceptually even, so 90 and 140 (lime and green) look far closer than
  // 190 and 240 (cyan and blue) despite the same gap. Greedily picking from a
  // list of anchors doesn't work either: it can't always find n that are far
  // enough apart and ends up relaxing its own guarantee.
  //
  // So positions are spaced evenly on a *perceptual* ladder — the anchors in
  // RRT_IDENTITY_HUES, treated as equal steps and interpolated between — and
  // then converted to real hues. Even spacing on that ladder means even
  // spacing to the eye, and it's guaranteed rather than searched for. The
  // start point is random and the jitter is capped well inside the step, so
  // the colours are different every round without ever crowding.
  const swatchTotal = types.filter((t) => t !== "letters").length;
  const ladderAt = (pos) => {
    const n = RRT_IDENTITY_HUES.length;
    const p = ((pos % n) + n) % n;
    const i = Math.floor(p);
    const f = p - i;
    const a = RRT_IDENTITY_HUES[i];
    let b = RRT_IDENTITY_HUES[(i + 1) % n];
    if (b < a) b += 360;
    return (a + (b - a) * f) % 360;
  };
  const ladderStart = Math.random() * RRT_IDENTITY_HUES.length;
  const ladderStep = RRT_IDENTITY_HUES.length / Math.max(swatchTotal, 1);
  const hueQueue = Array.from({ length: swatchTotal }, (_, i) => ({
    hue: ladderAt(ladderStart + i * ladderStep + (Math.random() - 0.5) * ladderStep * 0.3),
    // Second axis: alternating dark and light identity values, so even the
    // closest pair still differs in a way that survives being small.
    light: i % 2 === 0 ? 36 + Math.random() * 8 : 59 + Math.random() * 8,
  }));
  for (let i = hueQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hueQueue[i], hueQueue[j]] = [hueQueue[j], hueQueue[i]];
  }

  return types.map((type) => {
    if (type !== "letters") {
      const identity = hueQueue.pop() || { hue: Math.random() * 360, light: 50 };
      const hue = identity.hue;
      const name = rrtHueName(hue);
      usedColors.add(name);
      return {
        type: "voronoi",
        hue,
        identityLight: identity.light,
        colorName: name,
        patternSeed: `${name}-${Math.random().toString(36).slice(2)}`,
        wide: type === "wide",
        label: `the ${name} tile`,
      };
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


// ---------------------------------------------------------------------
// SPACE 2D
// ---------------------------------------------------------------------
// Items sit on a 2D grid and each premise gives one item's compass bearing
// from another — "MAY is North-East of NED". The deduction is genuinely
// spatial rather than a single ordering: you have to hold a rough map, not a
// line, which is why it's worth having alongside contains/comparison/vertical.
//
// Direction between any two distinct cells is read off the SIGNS of the
// offset, so every pair resolves to exactly one of the eight bearings and
// there's never an ambiguous or unprovable pair. Distance doesn't enter into
// it: two cells east and one north is North-East, same as one and one.
const RRT_SPACE2D_DIRS = [
  { name: "North", dx: 0, dy: 1 },
  { name: "North-East", dx: 1, dy: 1 },
  { name: "East", dx: 1, dy: 0 },
  { name: "South-East", dx: 1, dy: -1 },
  { name: "South", dx: 0, dy: -1 },
  { name: "South-West", dx: -1, dy: -1 },
  { name: "West", dx: -1, dy: 0 },
  { name: "North-West", dx: -1, dy: 1 },
];

function rrtSpaceDirectionFor(dx, dy) {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const hit = RRT_SPACE2D_DIRS.find((d) => d.dx === sx && d.dy === sy);
  return hit ? hit.name : null;
}

function generateRrtSpace2dPuzzle(premiseCount, branchingEnabled = true) {
  const itemCount = premiseCount + 1;
  const items = buildRrtItems(itemCount);

  const positions = [{ x: 0, y: 0 }];
  const taken = new Set(["0,0"]);
  const premises = [];
  const adjacency = Array.from({ length: itemCount }, () => []);

  for (let i = 1; i < itemCount; i++) {
    // Branching on: attach to any item placed so far, which spreads the map
    // out into a real shape. Branching off: always the previous item, giving
    // one walkable path — which is what scrambleFactor 0 relies on to
    // guarantee each premise shares an item with the next.
    const parentIdx = branchingEnabled ? Math.floor(Math.random() * i) : i - 1;
    const parent = positions[parentIdx];

    // Try random bearings until one lands on an empty cell. Two items in the
    // same cell would make the map contradictory, so a collision is retried
    // rather than accepted.
    let placed = null;
    let dirName = null;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const dir = RRT_SPACE2D_DIRS[Math.floor(Math.random() * RRT_SPACE2D_DIRS.length)];
      const candidate = { x: parent.x + dir.dx, y: parent.y + dir.dy };
      const key = `${candidate.x},${candidate.y}`;
      if (taken.has(key)) continue;
      placed = candidate;
      dirName = dir.name;
      taken.add(key);
    }
    if (!placed) {
      // Every bearing around this parent was occupied — fall back to a scan
      // outward so generation can't fail outright.
      outer: for (let r = 1; r < 6; r++) {
        for (const dir of RRT_SPACE2D_DIRS) {
          const candidate = { x: parent.x + dir.dx * r, y: parent.y + dir.dy * r };
          const key = `${candidate.x},${candidate.y}`;
          if (taken.has(key)) continue;
          placed = candidate;
          dirName = dir.name;
          taken.add(key);
          break outer;
        }
      }
    }

    positions.push(placed);
    premises.push({
      subject: items[i],
      relation: dirName,
      object: items[parentIdx],
      text: `${items[i].label} is ${dirName} of ${items[parentIdx].label}.`,
    });
    adjacency[i].push(parentIdx);
    adjacency[parentIdx].push(i);
  }

  const { aIdx, bIdx } = pickRrtConclusionPair(itemCount, adjacency);
  const actual = rrtSpaceDirectionFor(
    positions[aIdx].x - positions[bIdx].x,
    positions[aIdx].y - positions[bIdx].y
  );

  // Half the time ask the true bearing, half the time a different one. Since
  // every pair has exactly one correct bearing, a wrong one is always
  // genuinely wrong — no "can't be determined" cases to reason about.
  const askTrue = Math.random() < 0.5;
  const wrongOptions = RRT_SPACE2D_DIRS.map((d) => d.name).filter((n) => n !== actual);
  const askRelation = askTrue
    ? actual
    : wrongOptions[Math.floor(Math.random() * wrongOptions.length)];

  return {
    items,
    premises,
    positions,
    puzzleType: "space2d",
    conclusion: {
      subject: items[aIdx],
      relation: askRelation,
      object: items[bIdx],
      text: `Is ${items[aIdx].label} ${askRelation} of ${items[bIdx].label}?`,
      answer: askRelation === actual,
    },
  };
}

function generateRrtPuzzle(premiseCount, branchingEnabled = true, puzzleType) {
  const type = puzzleType || pickRrtPuzzleType();
  if (type === "space2d") {
    return generateRrtSpace2dPuzzle(premiseCount, branchingEnabled);
  }
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

// The "order" RRT puzzle types — contains/is-within, more-than/less-than,
// and on-top-of/is-under — share this one generator. Unlike the distinction
// puzzle above, this NEVER branches, even when branchingEnabled is on: each
// of these relations describes a strict physical stack (one thing directly
// containing/on top of/greater than the next), and a stack can't have two
// different items both sitting directly in the same position — "A contains
// B" and "A contains C" would mean B and C are both the one thing directly
// inside A, which doesn't correspond to any actual arrangement. So item i's
// premise always links back to i-1, forming one straight chain — item[0]
// through item[n-1] each directly related to the next, no forks. What
// branchingEnabled changes for THESE types is nothing; distinction is the
// only one it affects (see generateRrtDistinctionPuzzle), since a same/
// opposite equivalence class has no such "only one thing per spot"
// constraint.
//
// The chain also runs in ONE direction the whole way — every edge points the
// same way, chosen once per puzzle. An earlier version rolled each edge
// independently, which read as more varied but quietly produced impossible
// arrangements: a reversal makes some item the "peak", directly containing
// (or directly under) two different items at once, and no real stack looks
// like that. With a monotonic chain every pair has a genuine order, and the
// conclusion is False whenever it asserts the direction the chain doesn't
// support — which is a real deduction to make, not a trick.
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
  // One direction for the whole chain, chosen once. A per-edge coin flip
  // would let the order reverse partway along, which puts two items in the
  // same slot — see the note above this function.
  const chainAscending = Math.random() < 0.5;
  for (let i = 1; i < items.length; i++) {
    // Always i - 1, never branching — see the comment above this function
    // for why: two items can't both occupy the one spot directly
    // containing/on top of/exceeding the same item in a real stack.
    const parentIdx = i - 1;
    const iIsGreater = chainAscending;
    // Which item leads the sentence. Flipping it swaps the relation to its
    // opposite, which states the identical fact the other way round.
    const iLeads = Math.random() < 0.5;
    const subject = iLeads ? items[i] : items[parentIdx];
    const object = iLeads ? items[parentIdx] : items[i];
    const subjectIsGreater = iLeads ? iIsGreater : !iIsGreater;
    const relation = subjectIsGreater ? config.relations[0] : config.relations[1];
    premises.push({
      subject,
      relation,
      object,
      text: config.premiseText(subject, object, subjectIsGreater),
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
function rrtPolyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function voronoiCells(seedStr, baseHex, fixedFill = null) {
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
      let color;
      if (fixedFill) {
        // Painted below, once every cell's area is known — the stimulus
        // colour has to go on the biggest one.
        color = null;
      } else if (colorRand() < 0.85) {
        const accent = VORONOI_ACCENTS[Math.floor(colorRand() * VORONOI_ACCENTS.length)];
        color = mixHex(baseHex, accent, 0.4 + colorRand() * 0.45);
      } else {
        color = shadeHex(baseHex, (colorRand() - 0.5) * 1.1);
      }
      cells.push({
        points: poly.map((p) => p.join(",")).join(" "),
        color,
        area: fixedFill ? rrtPolyArea(poly) : 0,
      });
    }
  }

  if (fixedFill) {
    const pool = fixedFill.accents;
    // Two-thirds of the time take a consecutive run of the hue-ordered
    // palette, so the cells are near neighbours and the shape reads as one
    // colour family. The rest spread across the list for contrast. Without
    // that mix every stimulus looks the same amount of busy.
    const related = colorRand() < 0.66;
    const start = Math.floor(colorRand() * pool.length);
    const stride = related ? 1 : 1 + Math.floor(colorRand() * (pool.length - 2));
    // Biggest cell carries the stimulus colour, so the shape still announces
    // which colour it is even when the rest are close together.
    let biggest = 0;
    for (let i = 1; i < cells.length; i++) {
      if (cells[i].area > cells[biggest].area) biggest = i;
    }
    let taken = 0;
    cells.forEach((cell, i) => {
      cell.color =
        i === biggest
          ? fixedFill.identityColor
          : pool[(start + stride * taken++) % pool.length];
    });
  }

  return cells;
}

// ---------------------------------------------------------------------
// RRT SWATCH TILES
// ---------------------------------------------------------------------
// A recursive binary partition of the square: pick the biggest region,
// cut it with a straight line, repeat. Cuts are mostly axis-aligned with
// the occasional diagonal, which is what gives these their poster-like
// look — hard flat shapes meeting on clean edges, rather than the softer
// many-celled mosaic the QNB' swatches use.
//
// Colours are drawn fresh rather than derived from one base hue: each
// region gets its own random hue, and the lightness values are dealt from
// a shuffled spread of dark / mid / light so a tile reliably contains real
// contrast instead of three similar mid-tones. That contrast is the whole
// point — these have to be told apart at 28px, from memory, several
// premises later.
function rrtTileColor(rand, band, hue = Math.floor(rand() * 360), lightOverride = null) {
  // Bands: 0 = near-black, 1 = saturated mid, 2 = pastel. Saturation drops
  // at both ends because a fully saturated near-black reads as mud and a
  // fully saturated pastel reads as neon.
  const sat = band === 0 ? 45 + rand() * 30 : band === 1 ? 55 + rand() * 30 : 30 + rand() * 35;
  const light =
    lightOverride != null
      ? lightOverride
      : band === 0
      ? 8 + rand() * 9
      : band === 1
      ? 42 + rand() * 16
      : 74 + rand() * 16;
  // A hue is only legible at reasonable saturation once it's this light, so an
  // identity colour forced to a specific lightness gets saturation to match.
  const finalSat = lightOverride != null ? Math.max(sat, 58) : sat;
  return `hsl(${hue} ${Math.round(finalSat)}% ${Math.round(light)}%)`;
}

function rrtPolygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// `width` is in the same 0-100 units as the height, so a value of 200 gives
// the 2:1 landscape tile. Everything below works off the region's own bounding
// box, so nothing else needs to know the shape.
// `hueBase`, when given, is the identity of this tile: the largest region is
// painted in it and every other region is pushed at least 45 degrees away, so
// the shape you actually notice first is the one carrying the hue that tells
// two items apart. buildRrtItems hands out hueBase values spread evenly around
// the wheel, which is what stops two swatches in the same puzzle both reading
// as "the green one".
// `fixedFill` swaps the generated hues for a supplied palette: the largest
// region takes `identityColor` and the rest are dealt from `accents`. QNB'
// uses this because its fill colour IS the stimulus — a freely generated
// palette would destroy the thing the person is being asked to remember.
function rrtTileRegions(seedStr, width = 100, hueBase = null, identityLight = null, fixedFill = null) {
  const rand = mulberry32(hashStringToSeed(seedStr));
  let regions = [
    [
      [0, 0],
      [width, 0],
      [width, 100],
      [0, 100],
    ],
  ];
  const minPiece = 220 * (width / 100);

  // Landscape tiles are always exactly three colours — at 2:1 that reads as a
  // deliberate flag rather than an arbitrary carve-up, and it keeps the wide
  // shape distinct from the square at a glance. Squares vary from 2 to 5.
  const target =
    fixedFill && fixedFill.regions
      ? fixedFill.regions[Math.floor(rand() * fixedFill.regions.length)]
      : width > 100
      ? 3
      : 2 + Math.floor(rand() * 4);
  let guard = 0;
  let misses = 0;
  while (regions.length < target && guard < 60) {
    guard += 1;
    // A cut can be rejected for leaving too small a piece. If that keeps
    // happening the minimum is what's blocking the target, so ease it rather
    // than give up and return a tile with the wrong number of colours.
    const floorArea = misses > 10 ? minPiece * 0.45 : minPiece;
    // Always split the largest region, so the result is a few bold shapes
    // rather than one big field with slivers cut off its edge.
    let bi = 0;
    for (let i = 1; i < regions.length; i++) {
      if (rrtPolygonArea(regions[i]) > rrtPolygonArea(regions[bi])) bi = i;
    }
    const poly = regions[bi];
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Cut at 30-70% so neither side comes out as a sliver.
    const t = 0.3 + rand() * 0.4;
    let nx;
    let ny;
    let c;
    const roll = rand();
    if (roll < 0.35) {
      nx = 1;
      ny = 0;
      c = minX + (maxX - minX) * t;
    } else if (roll < 0.7) {
      nx = 0;
      ny = 1;
      c = minY + (maxY - minY) * t;
    } else {
      // Diagonal: a 45-degree cut in one of the four orientations.
      const dir = Math.floor(rand() * 4);
      nx = dir === 0 || dir === 3 ? 1 : -1;
      ny = dir === 0 || dir === 1 ? 1 : -1;
      const cx = minX + (maxX - minX) * t;
      const cy = minY + (maxY - minY) * t;
      c = nx * cx + ny * cy;
    }

    const a = clipPolygonHalfPlane(poly, nx, ny, c);
    const b = clipPolygonHalfPlane(poly, -nx, -ny, -c);
    // A cut that misses (or shaves off almost nothing) is discarded rather
    // than kept as a hairline that just reads as a rendering artefact.
    if (a.length >= 3 && b.length >= 3 && rrtPolygonArea(a) > floorArea && rrtPolygonArea(b) > floorArea) {
      regions.splice(bi, 1, a, b);
    } else {
      misses += 1;
    }
  }

  // Deal one lightness band per region from a shuffled spread, so every
  // tile has both a dark and a light area to read against.
  const bands = [];
  for (let i = 0; i < regions.length; i++) bands.push(i % 3);
  for (let i = bands.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bands[i], bands[j]] = [bands[j], bands[i]];
  }

  // Largest region first, so it can claim the identity hue.
  const order = regions
    .map((poly, i) => ({ i, area: rrtPolygonArea(poly) }))
    .sort((a, b) => b.area - a.area);
  const hues = new Array(regions.length).fill(null);
  if (hueBase != null) {
    hues[order[0].i] = hueBase;
    // Everything else lands in the 270 degrees that aren't within 45 of the
    // identity hue, so a supporting region can never be mistaken for it.
    for (let k = 1; k < order.length; k++) {
      hues[order[k].i] = Math.round((hueBase + 45 + rand() * 270) % 360);
    }
    // The identity region is pinned to a mid, saturated colour rather than
    // left to the band lottery. Near-black hides the hue entirely and pastel
    // washes it out — two pastels 50 degrees apart both just read as "pale
    // mint", which is exactly the collision this is meant to prevent.
    bands[order[0].i] = 1;
  }

  if (fixedFill) {
    // Walk the palette from a seed-derived offset rather than picking each
    // accent independently: that way one tile never uses the same accent
    // twice, and the palette stays recognisable round to round.
    const pool = fixedFill.accents;
    const step = Math.floor(rand() * pool.length);
    let taken = 0;
    return regions.map((poly, i) => ({
      points: poly.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" "),
      color:
        i === order[0].i
          ? fixedFill.identityColor
          : pool[(step + taken++) % pool.length],
    }));
  }

  return regions.map((poly, i) => ({
    points: poly.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" "),
    color: rrtTileColor(
      rand,
      bands[i],
      hues[i] ?? undefined,
      hueBase != null && i === order[0].i ? identityLight : null
    ),
  }));
}

function RrtItemTile({ item, size = 40 }) {
  const cells = useMemo(
    () =>
      item.type === "voronoi"
        ? rrtTileRegions(
            item.patternSeed || item.colorName || item.hex,
            item.wide ? 160 : 100,
            item.hue ?? null,
            item.identityLight ?? null
          )
        : null,
    [item.type, item.patternSeed, item.colorName, item.hex, item.wide]
  );
  if (item.type === "voronoi") {
    const voronoiSize = size * 0.86;
    return (
      <svg
        width={item.wide ? voronoiSize * 1.6 : voronoiSize}
        height={voronoiSize}
        viewBox={item.wide ? "0 0 160 100" : "0 0 100 100"}
        className="inline-block rounded-md shrink-0"
        style={{ outline: "1px solid rgba(0,0,0,0.55)", outlineOffset: "-1px" }}
      >
        {/* No stroke between regions: the reference look is hard flat shapes
            meeting on a clean edge. A stroke here reads as a mosaic grout
            line and softens exactly what makes these easy to tell apart. */}
        {cells.map((c, i) => (
          <polygon key={i} points={c.points} fill={c.color} />
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
// True only on devices with a real hover-capable pointer. Touchscreens report
// no hover, and their synthetic mouse events are what made an earlier hover
// implementation close the panel the moment it opened.
function rrtHasRealPointer() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

// ---------------------------------------------------------------------
// RRT TUTORIAL
// ---------------------------------------------------------------------
// A walk-through rather than a wall of text. The point it has to land is
// that spatializing is a FELT thing, not a picture in the head, so it opens
// with the room the person is actually sitting in before it mentions the
// app at all. Fixed items and a fixed layout, identical for everyone, so
// the explanation can be written rather than generated.
// One wide tile, one square, one three-letter word — the three shapes the
// exercise itself uses. Seeds chosen so the squares carve into exactly three
// colours (wide tiles always do), which keeps the tutorial's tiles simpler to
// hold than a live round's.
const RRT_TUTORIAL_ITEMS = [
  {
    type: "voronoi",
    hue: 220,
    identityLight: 58,
    colorName: "Blue",
    patternSeed: "tutorial-blue-2",
    wide: true,
    label: "the Blue tile",
  },
  {
    type: "voronoi",
    hue: 28,
    identityLight: 55,
    colorName: "Orange",
    patternSeed: "tutorial-orange-1",
    wide: false,
    label: "the Orange tile",
  },
  {
    type: "letters",
    letters: "VOK",
    label: "VOK",
  },
];


// Blue at the origin, Orange west of it, Green south of Orange. Chosen so
// the map is an L: two of the three relations are on an axis, and the third
// (Blue to Green) is a diagonal the person has to feel rather than read.
const RRT_TUTORIAL_POSITIONS = [
  { x: 0, y: 0 }, // Blue
  { x: -1, y: 0 }, // Orange
  { x: -1, y: -1 }, // Green
];

// The same grid the Explanation panel draws in a real round, built from the
// positions above. Kept as its own component so the tutorial and the game
// stay identical without either importing the other's layout.
function RrtTutorialMap({ items, positions, size = 46 }) {
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const cells = positions.map((p, i) => ({
    item: items[i],
    col: p.x - minX,
    row: maxY - p.y,
  }));
  return (
    <div
      className="mx-auto"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 4.25rem)`,
        gridTemplateRows: `repeat(${rows}, 4.25rem)`,
        gap: 0,
        borderTop: "1px solid #3A3D44",
        borderLeft: "1px solid #3A3D44",
        width: "fit-content",
      }}
    >
      {Array.from({ length: cols * rows }).map((_, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const here = cells.find((c) => c.col === col && c.row === row);
        return (
          <div
            key={idx}
            className="flex items-center justify-center"
            style={{
              borderRight: "1px solid #3A3D44",
              borderBottom: "1px solid #3A3D44",
            }}
          >
            {here ? <RrtItemTile item={here.item} size={size} /> : null}
          </div>
        );
      })}
    </div>
  );
}

// The 3D MOT walkthrough. Ten dots in a box: five glow gold, then every dot
// looks the same and the set drifts, then it freezes and the five you were
// meant to hold are picked back out. Flat and 2D on purpose — the real
// exercise adds depth, but the rule is easier to read without it.
function Motion3DTutorialDemo() {
  const COUNT = 10;
  const TARGETS = 5;
  const W = 320;
  const H = 210;
  const R = 15;
  const MOVE_MS = 1100;
  const MOVES = 3;
  const LIT_MS = 1400;

  const spread = () =>
    Array.from({ length: COUNT }, () => ({
      x: R + Math.random() * (W - 2 * R),
      y: R + Math.random() * (H - 2 * R),
    }));

  // Each move is a short hop from where the ball already is, not a jump to a
  // fresh spot: half the speed across the same run time.
  const HOP = 52;
  const drift = (prev) =>
    prev.map((p) => {
      const a = Math.random() * Math.PI * 2;
      const d = HOP * (0.5 + Math.random() * 0.5);
      return {
        x: Math.min(W - R, Math.max(R, p.x + Math.cos(a) * d)),
        y: Math.min(H - R, Math.max(R, p.y + Math.sin(a) * d)),
      };
    });

  const [spots, setSpots] = useState(() => spread());
  // 0 = targets lit, 1 = everything drifting, 2 = frozen and revealed.
  const [phase, setPhase] = useState(0);
  const letters = MOT_KEY_LETTERS.slice(0, COUNT);

  // Explicit timeouts rather than an interval: the freeze has to land on the
  // exact tick the last move finishes, or the balls light up while still
  // sliding.
  useEffect(() => {
    const timers = [setTimeout(() => setPhase(1), LIT_MS)];
    for (let i = 0; i < MOVES; i += 1) {
      timers.push(
        setTimeout(() => setSpots((prev) => drift(prev)), LIT_MS + i * MOVE_MS)
      );
    }
    timers.push(
      setTimeout(() => setPhase(2), LIT_MS + MOVES * MOVE_MS + 60)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex justify-center">
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          width: W,
          height: H,
          border: `1px solid ${NBACK_GRID_LINE}`,
          background: "#0B0D10",
        }}
      >
        {spots.map((p, i) => {
          const isTarget = i < TARGETS;
          const lit = phase === 0 && isTarget;
          const revealed = phase === 2 && isTarget;
          return (
            <div
              key={i}
              className="absolute flex items-center justify-center rounded-full"
              style={{
                width: R * 2,
                height: R * 2,
                left: 0,
                top: 0,
                transform: `translate(${p.x - R}px, ${p.y - R}px)`,
                transition: `transform ${MOVE_MS}ms linear, background 0.3s ease, box-shadow 0.3s ease, color 0.3s ease`,
                background: lit || revealed ? PR_YELLOW : "#2C313A",
                boxShadow: lit
                  ? `0 0 14px ${PR_YELLOW}99`
                  : revealed
                  ? `0 0 0 2px ${PR_YELLOW}`
                  : "none",
                color: lit || revealed ? "#0B0D10" : "#6E717A",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {letters[i].toUpperCase()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Motion3DTutorial({ onDone }) {
  const accent = EXERCISE_COLORS.motion3d;

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 border border-slate-700/70 rounded-xl p-8 space-y-6">
        <p className="text-slate-100 text-xl leading-relaxed text-center">
          Follow the balls.
        </p>
        <Motion3DTutorialDemo />
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={onDone}
          style={{ "--ex": accent }}
          className="w-36 shrink-0 deep-fill rounded-lg py-4 font-medium text-xl shadow-lg shadow-black/30"
        >
          I Get It
        </button>
      </div>
    </div>
  );
}

// The RRT tutorial: the items animate into the map as each premise is read,
// and the conclusion is picked out in gold.
function RrtTutorialAnimatedMap({ items, positions, revealed, highlight, size = 52 }) {
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const cells = positions.map((p, i) => ({
    index: i,
    item: items[i],
    col: p.x - minX,
    row: maxY - p.y,
  }));
  return (
    <div
      className="mx-auto"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 5.25rem)`,
        gridTemplateRows: `repeat(${rows}, 5.25rem)`,
        gap: 0,
        borderTop: "1px solid #3A3D44",
        borderLeft: "1px solid #3A3D44",
        width: "fit-content",
      }}
    >
      {Array.from({ length: cols * rows }).map((_, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const here = cells.find((c) => c.col === col && c.row === row);
        const shown = here && revealed.includes(here.index);
        const lit = here && highlight.includes(here.index);
        return (
          <div
            key={idx}
            className="flex items-center justify-center"
            style={{
              borderRight: "1px solid #3A3D44",
              borderBottom: "1px solid #3A3D44",
              background: lit ? `${PR_YELLOW}1A` : "transparent",
              outline: lit ? `2px solid ${PR_YELLOW}` : "none",
              outlineOffset: "-2px",
              transition: "background 0.3s ease, outline-color 0.3s ease",
            }}
          >
            {here ? (
              <div
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? "scale(1)" : "scale(0.6)",
                  transition: "opacity 0.45s ease, transform 0.45s ease",
                }}
              >
                <RrtItemTile item={here.item} size={size} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RrtTutorialAnimated({ onDone }) {
  const accent = EXERCISE_COLORS.rrt;
  const card = "bg-slate-900 border border-slate-700/70 rounded-xl p-8";
  const [blue, orange, green] = RRT_TUTORIAL_ITEMS;
  // step and beat move together. Keeping beat in its own state and zeroing it
  // from an effect let the new step paint once with the old beat, which showed
  // the incoming item for a frame before the animation ran.
  const [{ step, beat }, setPos] = useState({ step: 0, beat: 0 });
  const goToStep = (next) => setPos({ step: next, beat: 0 });

  // Only the last three steps touch the map. Each reveals one more item a
  // moment after its premise appears, so the map is seen being built rather
  // than arriving finished.
  const STEPS = [
    { revealAt: [[], []], highlight: [] },
    { revealAt: [[], []], highlight: [] },
    { revealAt: [[0], [0, 1]], highlight: [] },
    { revealAt: [[0, 1], [0, 1, 2]], highlight: [] },
    { revealAt: [[0, 1, 2], [0, 1, 2]], highlight: [0, 2] },
    { revealAt: [[], []], highlight: [] },
  ];

  useEffect(() => {
    const t = setTimeout(
      () => setPos((p) => (p.step === step ? { step, beat: 1 } : p)),
      900
    );
    return () => clearTimeout(t);
  }, [step]);

  const conf = STEPS[step];
  const revealed = conf.revealAt[Math.min(beat, conf.revealAt.length - 1)];
  const highlight = beat >= 1 ? conf.highlight : [];

  const map = (
    <RrtTutorialAnimatedMap
      items={RRT_TUTORIAL_ITEMS}
      positions={RRT_TUTORIAL_POSITIONS}
      revealed={revealed}
      highlight={highlight}
    />
  );

  const row = (a, text, b, lit) => (
    <div
      className="flex items-center justify-center gap-3.5 flex-wrap text-center rounded-lg px-3 py-3"
      style={{
        background: lit ? `${PR_YELLOW}14` : "transparent",
        border: `1px solid ${lit ? `${PR_YELLOW}80` : "transparent"}`,
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      <RrtItemTile item={a} size={46} />
      <span className="text-slate-100 text-xl font-medium">{text}</span>
      <RrtItemTile item={b} size={46} />
    </div>
  );

  const bodies = [
    <div className={`${card} space-y-4`} key="s0">
      <p className="text-slate-200 text-xl leading-relaxed">
        Close your eyes and feel where different objects are in your room.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        Don't imagine the object.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        Feel where the door is.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        Feel where the chair is.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        Feel where the table is.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        Feel the space. Feel the direction.
      </p>
    </div>,

    <div className={`${card} space-y-4`} key="s1">
      <p className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>
        This is spatializing.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        In RRT you spatialize the items. You don't imagine them. You{" "}
        <em className="italic">feel</em> where the items are in relation to each
        other.
      </p>
    </div>,

    <div className={`${card} space-y-6`} key="s2">
      {row(orange, "is West of", blue, false)}
      {map}
      <p className="text-slate-100 text-lg leading-relaxed text-center">
        Feel where each item is.
      </p>
    </div>,

    <div className={`${card} space-y-6`} key="s3">
      {row(green, "is South of", orange, false)}
      {map}
      <p className="text-slate-100 text-lg leading-relaxed text-center">
        Feel where each item is.
      </p>
    </div>,

    <div className={`${card} space-y-6`} key="s4">
      {map}
      <div className="text-center">
        <div
          className="italic font-bold tracking-wide text-lg"
          style={{ color: accent }}
        >
          CONCLUSION
        </div>
      </div>
      {row(green, "is South-West of", blue, beat >= 1)}
      <div className="flex items-center justify-center gap-2 flex-wrap text-center text-slate-100 text-lg">
        <span>Can you feel how</span>
        <RrtItemTile item={green} size={30} />
        <span>is south-west of</span>
        <RrtItemTile item={blue} size={30} />
        <span>?</span>
      </div>
    </div>,

    <div className={`${card} space-y-4`} key="s5">
      <p className="text-slate-100 text-lg leading-relaxed">
        Feel where each item is. Don't imagine the items moving around on your
        screen.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        If it helps, you can close your eyes until you get the hang of
        spatializing.
      </p>
      <p className="text-slate-100 text-lg leading-relaxed">
        It should be like feeling where your door is in your room.
      </p>
    </div>,
  ];

  const isLast = step >= STEPS.length - 1;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= step ? accent : "#1E293B" }}
          />
        ))}
      </div>

      <div key={step} style={{ animation: "switchIn 0.5s ease-out both" }}>
        {bodies[step]}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => goToStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="w-36 shrink-0 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg py-4 font-medium text-xl"
        >
          Back
        </button>
        <button
          onClick={() => (isLast ? onDone() : goToStep(step + 1))}
          style={{ "--ex": accent }}
          className="w-36 shrink-0 deep-fill rounded-lg py-4 font-medium text-xl shadow-lg shadow-black/30"
        >
          {isLast ? "I Get It" : "Next"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// N-BACK TUTORIALS
// ---------------------------------------------------------------------
// One walkthrough serving Dual, Quad and QNB', built from the exercise's own
// modality list so each version only teaches the streams it actually runs.
// The point it has to land is that you are never remembering the sequence,
// only ever holding the last N of it.

// A row of small 3x3 grids showing one stream over consecutive trials. The
// trials that make the point are highlighted; everything else stays quiet.
function NBackTutorialDemo({ exercise, accent }) {
  // Always 2 back, whatever level the player is actually on: the point is to
  // see the rule, and 2 is the shortest gap that shows it.
  const n = 2;
  const mods = exercise.modalities || [];
  const hasShape = mods.includes("shape");
  const hasColor = mods.includes("color");
  const hasAudio = mods.includes("audio");
  const isPrime = exercise.key === "iqnb";
  const shapeSet = isPrime ? QNB_PRIME_SHAPES : SHAPE_TYPES;
  const label = isPrime ? "QNB' 2.00" : `${exercise.abbrev}2B`;

  // Four distinct items, then a run where item B repeats exactly two places
  // later, twice.
  const defs = [
    { pos: 0, color: COLORS[0], shape: shapeSet[0], letter: "K" },
    { pos: 4, color: COLORS[3], shape: shapeSet[1], letter: "L" },
    { pos: 8, color: COLORS[2], shape: shapeSet[2], letter: "R" },
    { pos: 6, color: COLORS[4], shape: shapeSet[3], letter: "Z" },
  ];
  // Four trials: three new items, then the second one again. It runs once and
  // stops on the match, so the last thing on screen is the thing to learn.
  const seq = [defs[0], defs[1], defs[2], defs[1]];

  const [i, setI] = useState(-1);

  // The tutorial is only ever reached by clicking, so the context can be
  // resumed here. Without this the first letters fall through to speech
  // synthesis while the samples are still being fetched.
  useEffect(() => {
    if (hasAudio) unlockLetterAudio();
  }, [hasAudio]);

  useEffect(() => {
    if (i >= seq.length - 1) return undefined;
    const t = setTimeout(() => setI((v) => v + 1), i === -1 ? 1400 : 1900);
    return () => clearTimeout(t);
  }, [i, seq.length]);

  useEffect(() => {
    if (!hasAudio || i < 0 || i >= seq.length) return;
    speak(seq[i].letter);
  }, [i, hasAudio]);

  const cur = i >= 0 ? seq[i] : null;
  const isMatch = i >= n && seq[i] === seq[i - n];

  const stimulus = (item, size) =>
    hasShape || hasColor ? (
      isPrime ? (
        <VoronoiShapeIcon
          shape={hasShape ? item.shape : shapeSet[0]}
          color={hasColor ? item.color : accent}
          seed={`tut-${item.shape}-${item.color}`}
          size={size}
        />
      ) : (
        <ShapeIcon
          shape={hasShape ? item.shape : "square"}
          color={hasColor ? item.color : accent}
          size={size}
        />
      )
    ) : null;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* The 2 is picked out in gold so the label reads as the same "2" the
          demo is about: two back, two places ago. */}
      <div className="text-sm tracking-[0.08em] uppercase" style={{ color: accent }}>
        {isPrime ? (
          <>
            QNB'{" "}
            <span
              style={{
                color: isMatch ? PR_YELLOW : "inherit",
                fontWeight: isMatch ? 600 : "inherit",
                transition: "color 0.2s ease",
              }}
            >
              2.00
            </span>
          </>
        ) : (
          <>
            {exercise.abbrev}
            <span
              style={{
                color: isMatch ? PR_YELLOW : "inherit",
                fontWeight: isMatch ? 600 : "inherit",
                transition: "color 0.2s ease",
              }}
            >
              2
            </span>
            B
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 4rem)",
          gridTemplateRows: "repeat(3, 4rem)",
          borderTop: `1px solid ${NBACK_GRID_LINE}`,
          borderLeft: `1px solid ${NBACK_GRID_LINE}`,
          borderRadius: 4,
        }}
      >
        {POSITIONS.map((cell) => {
          const active = cur && cell === cur.pos;
          return (
            <div
              key={cell}
              className="flex items-center justify-center overflow-hidden"
              style={{
                borderRight: `1px solid ${NBACK_GRID_LINE}`,
                borderBottom: `1px solid ${NBACK_GRID_LINE}`,
                background: active ? NBACK_CELL_ACTIVE : NBACK_CELL_BG,
                transition: "background 0.12s linear",
              }}
            >
              {active && stimulus(cur, 50)}
            </div>
          );
        })}
      </div>

      <div className="flex items-end justify-center gap-2 flex-wrap min-h-[3.4rem]">
        {seq.map((item, idx) => {
          if (idx > i) return null;
          const marked = isMatch && (idx === i || idx === i - n);
          return (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center"
                style={{
                  width: "1.7rem",
                  height: "1.7rem",
                  border: `1px solid ${NBACK_GRID_LINE}`,
                  outline: marked ? `2px solid ${PR_YELLOW}` : "none",
                  outlineOffset: "2px",
                  borderRadius: 2,
                  background: NBACK_CELL_ACTIVE,
                  opacity: idx === i ? 1 : 0.55,
                }}
              >
                {hasShape || hasColor ? (
                  stimulus(item, 21)
                ) : (
                  <span className="text-[0.7rem] font-semibold text-slate-900">
                    {item.letter}
                  </span>
                )}
              </div>
              <div
                className="text-[0.65rem] tabular-nums"
                style={{ color: marked ? PR_YELLOW : "#6E717A" }}
              >
                {idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {mods.map((m) => (
          <div
            key={m}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors flex items-center gap-2"
            style={{
              border: `1px solid ${isMatch ? PR_YELLOW : "#2A2E37"}`,
              color: isMatch ? PR_YELLOW : "#6E717A",
              background: isMatch ? `${PR_YELLOW}1A` : "transparent",
            }}
          >
            <span>{MODALITY_META[m].label}</span>
            <span className="text-base leading-none">{MODALITY_KEY_LABEL[m]}</span>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg px-5 py-2.5 text-base font-semibold transition-colors"
        style={{
          border: `1px solid ${isMatch ? PR_YELLOW : "#2A2E37"}`,
          color: isMatch ? PR_YELLOW : "#6E717A",
          background: isMatch ? `${PR_YELLOW}1A` : "transparent",
        }}
      >
        {isMatch ? "Press" : "Don't press"}
      </div>

      <div
        className="text-sm text-center min-h-[1.25rem]"
        style={{ color: isMatch ? PR_YELLOW : "#6E717A" }}
      >
        {i < 0
          ? "\u00A0"
          : isMatch
          ? "Same item as 2 places ago."
          : i < n
          ? "Nothing to compare it to yet."
          : "Not the same as 2 places ago."}
      </div>
    </div>
  );
}

function NBackTutorial({ exercise, onDone, level }) {
  const [step, setStep] = useState(0);
  const accent = EXERCISE_COLORS[exercise.key] || "#4CB9D8";
  const card = "bg-slate-900 border border-slate-700/70 rounded-xl p-8";
  // Every n-back tutorial demonstrates at 2 back, whatever level the player
  // is actually on.
  const n = 2;

  const nav = (label, onClick) => (
    <div className="flex items-center justify-between gap-3">
      <button
        onClick={() => setStep((v) => Math.max(0, v - 1))}
        disabled={step === 0}
        className="w-36 shrink-0 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg py-4 font-medium text-xl"
      >
        Back
      </button>
      <button
        onClick={onClick}
        style={{ "--ex": accent }}
        className="w-36 shrink-0 deep-fill rounded-lg py-4 font-medium text-xl shadow-lg shadow-black/30"
      >
        {label}
      </button>
    </div>
  );

  const steps = [];

  steps.push({
    body: (
      <div className={`${card} space-y-4`}>
        <p className="text-slate-100 text-xl leading-relaxed">
          You will be shown an item. Remember the item.
        </p>
        <p className="text-slate-100 text-xl leading-relaxed">
          When the item you see right now is the same as the item 2 places
          ago, press the button.
        </p>
        <p className="text-slate-100 text-xl leading-relaxed">
          If it is not, press nothing.
        </p>
      </div>
    ),
  });

  steps.push({
    body: (
      <div className={`${card}`}>
        <NBackTutorialDemo exercise={exercise} accent={accent} />
      </div>
    ),
  });

  const isLast = step >= steps.length - 1;
  const current = steps[Math.min(step, steps.length - 1)];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= step ? accent : "#1E293B" }}
          />
        ))}
      </div>

      <div key={step} style={{ animation: "switchIn 0.5s ease-out both" }}>
        {current.body}
      </div>

      {nav(isLast ? "I get it" : "Next", () =>
        isLast ? onDone() : setStep((v) => v + 1)
      )}
    </div>
  );
}

function RrtHistoryItemChip({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item)}
      className="inline-flex items-center gap-1.5 rounded-md px-0.5 py-0.5 opacity-100 hover:opacity-80 transition-opacity"
    >
      <RrtItemTile item={item} size={38} />
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
  if (entry.puzzleType === "space2d") return buildRrtSpace2dExplanation(entry);
  return RRT_ORDER_CONFIGS[entry.puzzleType]
    ? buildRrtOrderExplanation(entry)
    : buildRrtDistinctionExplanation(entry);
}

// The explanation for a spatial puzzle is the map itself: every item dropped
// on the grid it was actually generated on, so the conclusion's bearing can
// be read off directly instead of re-derived premise by premise. Normalised
// to a 0-based grid with y flipped, since screen rows run downward and North
// runs up.
function buildRrtSpace2dExplanation(entry) {
  const positions = entry.positions || [];
  if (!positions.length) {
    return { puzzleType: "space2d", cells: [], cols: 0, rows: 0, groups: null };
  }
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    puzzleType: "space2d",
    cols: maxX - minX + 1,
    rows: maxY - minY + 1,
    cells: positions.map((p, i) => ({
      item: entry.items[i],
      col: p.x - minX,
      row: maxY - p.y,
    })),
    groups: null,
  };
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
  // Walk the whole chain rather than just aIdx -> bIdx. The premises form a
  // path graph, so the two items with a single neighbour are its ends; start
  // at one and walk to the other to recover the full ordering.
  const ends = items
    .map((_, i) => i)
    .filter((i) => adjacency[i].length === 1);
  const pathIdx = [];
  const pathRelations = [];
  if (ends.length === 2) {
    let prev = -1;
    let node = ends[0];
    while (node != null) {
      pathIdx.push(node);
      const next = adjacency[node].find((e) => e.to !== prev);
      if (!next) break;
      pathRelations.push(next.sign === 1 ? config.relations[0] : config.relations[1]);
      prev = node;
      node = next.to;
    }
    // Orient it so the chain reads in the "greater" direction throughout,
    // whichever way the walk happened to start.
    if (pathRelations[0] === config.relations[1]) {
      pathIdx.reverse();
      pathRelations.reverse();
      for (let i = 0; i < pathRelations.length; i++) {
        pathRelations[i] =
          pathRelations[i] === config.relations[0] ? config.relations[1] : config.relations[0];
      }
    }
  } else {
    // Fallback for anything that isn't a clean path (older history entries
    // saved before the chain was made monotonic): the original a -> b walk.
    pathIdx.push(bIdx);
    let cur = bIdx;
    while (cur !== aIdx) {
      const edge = parentEdge[cur];
      if (!edge) break;
      pathRelations.push(edge.sign === 1 ? config.relations[0] : config.relations[1]);
      cur = edge.from;
      pathIdx.push(cur);
    }
    pathIdx.reverse();
    pathRelations.reverse();
  }
  const chainItems = pathIdx.map((i) => items[i]);
  const chainRelations = pathRelations;
  const determinate =
    chainRelations.length > 0 && chainRelations.every((r) => r === chainRelations[0]);

  return { puzzleType, chainItems, chainRelations, determinate, groups: null };
}

function ShapeIcon({ shape, color, size = 64 }) {
  const s = size;
  // Every shape carries the same dark edge. On the near-white active cell a
  // light stimulus colour otherwise has nothing holding its silhouette, and
  // the shapes that do have an outline look like a different set.
  const common = {
    fill: color,
    stroke: "#12171F",
    strokeWidth: 2.4,
    strokeLinejoin: "round",
  };
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

// ---------------------------------------------------------------------
// QNB' SHAPE SET
// ---------------------------------------------------------------------
// Plain geometric figures, drawn on a common circumradius so no one shape
// looks oversized next to another. Vertices are computed rather than
// eyeballed, which is most of why these read as clean.
//
// Geometry isn't copyrightable — a regular octagon is a regular octagon — so
// there's nothing to license here, unlike an icon set.
//
// Chosen for silhouette separation as much as looks: the whole task is telling
// one from another several trials later, so the set avoids near-neighbours
// (no heptagon next to the octagon, no six-point star next to the five).
//
// An entry is a list because a clipPath unions its children — but every shape
// here is a single element, since each part gets stroked separately and a
// union of primitives shows its internal seams as if they were mistakes.
const QNB_SHAPE_GEOMETRY = {
  circle: [{ el: "circle", props: { cx: 50, cy: 50, r: 44 } }],
  square: [{ el: "rect", props: { x: 8, y: 8, width: 84, height: 84, rx: 4 } }],
  triangle: [{ el: "polygon", props: { points: "50,6 88.1,72 11.9,72" } }],
  diamond: [{ el: "polygon", props: { points: "50,4 92,50 50,96 8,50" } }],
  pentagon: [
    { el: "polygon", props: { points: "50,6 91.8,36.4 75.9,85.6 24.1,85.6 8.2,36.4" } },
  ],
  hexagon: [
    { el: "polygon", props: { points: "50,6 88.1,28 88.1,72 50,94 11.9,72 11.9,28" } },
  ],
  octagon: [
    {
      el: "polygon",
      props: { points: "66.8,9.3 90.7,33.2 90.7,66.8 66.8,90.7 33.2,90.7 9.3,66.8 9.3,33.2 33.2,9.3" },
    },
  ],
  star: [
    {
      el: "polygon",
      props: {
        points: "50,4 61.2,34.6 93.7,35.8 68.1,55.9 77,87.2 50,69 23,87.2 31.9,55.9 6.3,35.8 38.8,34.6",
      },
    },
  ],
  cross: [
    {
      el: "polygon",
      props: { points: "36,6 64,6 64,36 94,36 94,64 64,64 64,94 36,94 36,64 6,64 6,36 36,36" },
    },
  ],
  // A rounded bar and an ellipse aren't polygons, which keeps them clearly
  // apart from everything above at a glance rather than only on inspection.
  ellipse: [{ el: "ellipse", props: { cx: 50, cy: 50, rx: 44, ry: 30 } }],
  arch: [
    {
      el: "path",
      props: { d: "M10 92 V44 A40 40 0 0 1 90 44 V92 Z" },
    },
  ],
  // A trapezoid rather than a chevron: the chevron's notch read as two arrows
  // rather than one shape at this size, and a concave outline fights the
  // Voronoi fill behind it.
  trapezoid: [{ el: "polygon", props: { points: "24,10 76,10 94,90 6,90" } }],
};

const QNB_SHAPE_TYPES = Object.keys(QNB_SHAPE_GEOMETRY);

// Supporting colours inside a QNB' stimulus. One fixed set, always the same,
// so the palette becomes familiar rather than novel every trial — but wide
// enough in hue that a shape reads as a real mosaic rather than a colour with
// grey on it.
//
// The neutral version of this list was a mistake: it made every stimulus a
// bold field with a plain wedge beside it, which is far too easy to tell
// apart. Colour is what makes two of these genuinely hard to hold apart in
// working memory, which is the entire point of the exercise.
// No entry may be lighter than the cell behind it (#F7F8F8) — a near-white
// cell would read as a hole in the shape rather than as part of it, which is
// why the cream here is knocked down well below the background.
//
// Ordered by hue, deliberately — voronoiCells takes a consecutive run from
// this list most of the time, so neighbouring entries need to be neighbouring
// colours. Reordering it changes how the stimuli look, not just their order.
const QNB_FILL_ACCENTS = [
  "#E08A6A",
  "#C2410C",
  "#DDD6C4",
  "#6B7F33",
  "#166534",
  "#0F766E",
  "#0EA5B7",
  "#4B5563",
  "#12171F",
  "#1E3A8A",
  "#6D28D9",
  "#9F1239",
];

// Hue distance in degrees, the short way round the wheel.
function qnbHueOf(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null; // greys have no hue to compare
  const d = max - min;
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return ((hue * 60) + 360) % 360;
}

// Accents at least 40 degrees off the stimulus hue. Greys and near-blacks
// always qualify — they can't be confused with a colour. Falls back to the
// whole list if the filter is ever too aggressive to leave enough to work
// with.
function qnbAccentsFor(stimulusHex) {
  const base = qnbHueOf(stimulusHex);
  if (base == null) return QNB_FILL_ACCENTS;
  const ok = QNB_FILL_ACCENTS.filter((hex) => {
    const h = qnbHueOf(hex);
    if (h == null) return true;
    const d = Math.abs(h - base) % 360;
    return (d > 180 ? 360 - d : d) >= 40;
  });
  return ok.length >= 4 ? ok : QNB_FILL_ACCENTS;
}

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


// ---------------------------------------------------------------------
// QNB' SHAPE SET
// ---------------------------------------------------------------------
// QNB' gets its own shapes, deliberately nothing like the basic polygons
// Quad N-Back uses, so the two exercises never feel like the same task.
//
// Two families:
//
// POLYOMINOES — tetrominoes and pentominoes. The outlines are generated from
// their cell grids by tracing the boundary, so each is one closed path rather
// than four squares with visible seams where they meet. Geometry, not
// artwork: nothing is copied from anywhere.
const QNB_POLYOMINO_GEOMETRY = {
  tetI: { el: "path", props: { d: "M6.0 39.0 L94.0 39.0 L94.0 61.0 L6.0 61.0 Z" } },
  tetO: { el: "path", props: { d: "M6.0 6.0 L94.0 6.0 L94.0 94.0 L6.0 94.0 Z" } },
  tetT: { el: "path", props: { d: "M6.0 20.7 L94.0 20.7 L94.0 50.0 L64.7 50.0 L64.7 79.3 L35.3 79.3 L35.3 50.0 L6.0 50.0 Z" } },
  tetS: { el: "path", props: { d: "M35.3 20.7 L94.0 20.7 L94.0 50.0 L64.7 50.0 L64.7 79.3 L6.0 79.3 L6.0 50.0 L35.3 50.0 Z" } },
  tetZ: { el: "path", props: { d: "M6.0 20.7 L64.7 20.7 L64.7 50.0 L94.0 50.0 L94.0 79.3 L35.3 79.3 L35.3 50.0 L6.0 50.0 Z" } },
  tetJ: { el: "path", props: { d: "M6.0 20.7 L35.3 20.7 L35.3 50.0 L94.0 50.0 L94.0 79.3 L6.0 79.3 Z" } },
  tetL: { el: "path", props: { d: "M64.7 20.7 L94.0 20.7 L94.0 79.3 L6.0 79.3 L6.0 50.0 L64.7 50.0 Z" } },
  penP: { el: "path", props: { d: "M20.7 6.0 L79.3 6.0 L79.3 64.7 L50.0 64.7 L50.0 94.0 L20.7 94.0 Z" } },
  penU: { el: "path", props: { d: "M6.0 20.7 L35.3 20.7 L35.3 50.0 L64.7 50.0 L64.7 20.7 L94.0 20.7 L94.0 79.3 L6.0 79.3 Z" } },
  penF: { el: "path", props: { d: "M35.3 6.0 L94.0 6.0 L94.0 35.3 L64.7 35.3 L64.7 94.0 L35.3 94.0 L35.3 64.7 L6.0 64.7 L6.0 35.3 L35.3 35.3 Z" } },
  penW: { el: "path", props: { d: "M6.0 6.0 L35.3 6.0 L35.3 35.3 L64.7 35.3 L64.7 64.7 L94.0 64.7 L94.0 94.0 L35.3 94.0 L35.3 64.7 L6.0 64.7 Z" } },
  penX: { el: "path", props: { d: "M35.3 6.0 L64.7 6.0 L64.7 35.3 L94.0 35.3 L94.0 64.7 L64.7 64.7 L64.7 94.0 L35.3 94.0 L35.3 64.7 L6.0 64.7 L6.0 35.3 L35.3 35.3 Z" } },
};

// PICTOGRAMS — the US National Park Service map symbols, which are a federal
// work and therefore public domain. They are white-on-transparent PNGs, used
// here as SVG masks so the Voronoi fill shows through the symbol's silhouette
// and takes the trial's colour, exactly as the vector shapes do.
const QNB_PICTOGRAM_BASE = "/images/qnb/";
const QNB_PICTOGRAMS = [
  "campfire",
  "sailing",
  "airport",
  "fishing",
  "telephone",
  "horseback-riding",
  "swimming",
  "picnic-area",
  "drinking-water",
  "gas-station",
  "lodging",
  "store",
];

// The pool QNB' draws from. Prefixed so the renderer can tell at a glance
// which family a shape belongs to.
const QNB_PRIME_SHAPES = [
  ...Object.keys(QNB_POLYOMINO_GEOMETRY),
  ...QNB_PICTOGRAMS.map((n) => `nps:${n}`),
];

const QNB_POLYOMINO_SHAPES = Object.keys(QNB_POLYOMINO_GEOMETRY);
const QNB_PICTOGRAM_SHAPES = QNB_PICTOGRAMS.map((n) => `nps:${n}`);

// The pictogram PNGs are fetched by the browser the first time an <image>
// inside a mask points at them, which is mid-trial — the cell paints empty
// for a frame or two before the symbol appears. Warming the cache ahead of
// the run removes that flash. Cheap: twelve files, a few KB each.
let qnbPictogramsPreloaded = false;
function preloadQnbPictograms() {
  if (qnbPictogramsPreloaded || typeof window === "undefined") return;
  qnbPictogramsPreloaded = true;
  QNB_PICTOGRAMS.forEach((name) => {
    const img = new Image();
    img.src = `${QNB_PICTOGRAM_BASE}${name}.png`;
  });
}

// A real Fisher-Yates. `sort(() => Math.random() - 0.5)` is not a shuffle:
// the comparator is inconsistent, so the result is heavily biased toward the
// original order, which meant the pool almost always came out as the first
// few polyominoes and the first few pictograms and the rest of the set never
// appeared. Drawn half from each family so a session always mixes the two.
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Picking a fresh random handful each time meant some shapes went many
// sessions without ever appearing. Instead each family is a deck that is
// dealt from and only reshuffled once it runs out, so a few sessions cover
// the whole set and nothing sits unseen.
const QNB_DECK_KEY = "cortex.qnbDecks.v1";
function readQnbDecks() {
  try {
    const raw = localStorage.getItem(QNB_DECK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.poly) && Array.isArray(parsed.pict)) return parsed;
  } catch {
    /* fall through to a fresh pair of decks */
  }
  return { poly: [], pict: [] };
}
function dealFrom(deck, source, count) {
  let d = deck.filter((x) => source.includes(x));
  const out = [];
  while (out.length < count) {
    if (d.length === 0) d = shuffled(source);
    out.push(d.shift());
  }
  return { taken: out, rest: d };
}
function pickQnbShapeSet(count = 8) {
  const half = Math.floor(count / 2);
  const decks = readQnbDecks();
  const poly = dealFrom(decks.poly, QNB_POLYOMINO_SHAPES, half);
  const pict = dealFrom(decks.pict, QNB_PICTOGRAM_SHAPES, count - half);
  try {
    localStorage.setItem(
      QNB_DECK_KEY,
      JSON.stringify({ poly: poly.rest, pict: pict.rest })
    );
  } catch {
    /* a session without persistence just gets a random draw next time */
  }
  return shuffled([...poly.taken, ...pict.taken]);
}

// QNB' draws its color/shape stimulus as a Voronoi-textured blob clipped to
// the same outline ShapeIcon uses, instead of a flat solid fill — reuses the
// same voronoiCells() generator RRT's Voronoi items use.
function VoronoiShapeIcon({ shape, color, seed, size = 64 }) {
  // Three sources, in order: a pictogram (masked PNG), a polyomino, or one of
  // the original polygons. QNB_SHAPE_GEOMETRY is still defined for when a
  // different vector set is wanted.
  const isPictogram = typeof shape === "string" && shape.startsWith("nps:");
  const parts = isPictogram
    ? []
    : [
        QNB_POLYOMINO_GEOMETRY[shape] ||
          SHAPE_CLIP_GEOMETRY[shape] ||
          SHAPE_CLIP_GEOMETRY.square,
      ];
  const safeId = `${shape}`.replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `qnbp-clip-${safeId}-${(seed || color).replace(/[^a-zA-Z0-9]/g, "")}`;
  // The same straight-cut partition RRT's tiles use, rather than the older
  // many-celled mosaic: fewer, bigger, flat regions read far better at this
  // size. The stimulus colour takes the largest region so the shape still
  // announces which colour it is, and the supporting regions come from one
  // fixed palette — varied enough not to feel repetitive, constant enough that
  // an unfamiliar colour never appears and competes with the stimulus.
  const cells = useMemo(
    () =>
      voronoiCells(`${seed || color}-${shape}`, color, {
        identityColor: color,
        accents: QNB_FILL_ACCENTS,
      }),
    [seed, color, shape]
  );
  if (isPictogram) {
    // The PNG is white on transparent, so its alpha is the silhouette. Used
    // as a mask, the Voronoi fill shows through the symbol and takes the
    // trial's colour — the same trick Brain Workshop uses to get any shape in
    // any colour from one file.
    const maskId = `qnbp-mask-${safeId}-${(seed || color).replace(/[^a-zA-Z0-9]/g, "")}`;
    const outlineMaskId = `${maskId}-o`;
    const dilateId = `${maskId}-d`;
    const href = `${QNB_PICTOGRAM_BASE}${shape.slice(4)}.png`;
    // A PNG silhouette cannot take an SVG stroke. Scaling a second copy up
    // and putting it behind does not work either: scaling grows the shape
    // away from its centre, so the edge nearest the middle gets no outline
    // at all and the far edge gets a fat one. feMorphology dilates the alpha
    // itself, which grows every edge by the same amount in every direction —
    // a true outline. Set to the stroke width the vector shapes use, so the
    // two families read at the same weight.
    const OUTLINE = 1.3;
    const inset = 1 + OUTLINE;
    const span = 100 - inset * 2;
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <filter
            id={dilateId}
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology operator="dilate" radius={OUTLINE} />
          </filter>
          <mask id={outlineMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <image
              href={href}
              x={inset}
              y={inset}
              width={span}
              height={span}
              preserveAspectRatio="xMidYMid meet"
              filter={`url(#${dilateId})`}
            />
          </mask>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <image
              href={href}
              x={inset}
              y={inset}
              width={span}
              height={span}
              preserveAspectRatio="xMidYMid meet"
            />
          </mask>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="#12171F" mask={`url(#${outlineMaskId})`} />
        <g mask={`url(#${maskId})`}>
          {cells.map((c, i) => (
            <polygon key={i} points={c.points} fill={c.color} />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <clipPath id={clipId}>
          {parts.map((part, i) => {
            const El = part.el;
            return <El key={i} {...part.props} />;
          })}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {cells.map((c, i) => (
          <polygon key={i} points={c.points} fill={c.color} />
        ))}
      </g>
      {/* Outline drawn over the fill rather than clipped by it — a clipped
          stroke loses its outer half and renders at half the weight asked
          for. Kept thin so it defines the silhouette against the light cell
          without becoming a feature of its own. */}
      {parts.map((part, i) => {
        const El = part.el;
        return (
          <El
            key={`o${i}`}
            {...part.props}
            fill="none"
            stroke="#12171F"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}


// Tier list is deliberately generic (not tied to any one exercise's max level),
// so e.g. "D6B" (Dual 6-Back) and "Q6B" (Quad 6-Back) both carry the same name.
const GEM_TIERS = {
  1: { color: "#94a3b8", glow: false, label: "Novice" },
  2: { color: "#4ade80", glow: true, label: "Proficient" },
  3: { color: "#38bdf8", glow: true, label: "Adept" },
  4: { color: "#818CF8", glow: true, label: "Bright" },
  5: { color: "#22d3ee", glow: true, label: "Radiant" },
  6: { color: "#fb7185", glow: true, label: "Illuminated" },
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

// ---------------------------------------------------------------------
// LEGAL PAGES
// ---------------------------------------------------------------------
// Written for this app specifically rather than pasted from a generator, so
// the data it names is the data actually collected. It still needs a lawyer's
// eye before launch: the sections on liability, governing law and consumer
// guarantees are the ones that carry real risk if they are wrong.
const LEGAL_CONTACT = "hello@cortex.app";
const LEGAL_UPDATED = "31 August 2026";

const PRIVACY_POLICY = {
  title: "Privacy Policy",
  intro:
    "This policy explains what Cortex collects, why, and what you can do about it. It is written to be read, not to be skimmed past.",
  sections: [
    {
      h: "Who we are",
      p: [
        "Cortex is a brain-training application. For the purposes of data protection law we are the data controller for the information described below. Reach us at " +
          LEGAL_CONTACT + ".",
      ],
    },
    {
      h: "What we collect",
      list: [
        "Your email address, so you can sign in and we can contact you about your account.",
        "A display name, which you choose and can change.",
        "Your training data: which exercises you did, when, how long for, the level you reached and the accuracy you scored.",
        "Your settings, such as your chosen regime and whether background audio is on.",
        "Payment records held by our payment processor. We never see or store your card number.",
        "Basic technical information your browser sends, such as device type and browser version, and error reports when something in the app fails.",
      ],
    },
    {
      h: "What we do not collect",
      list: [
        "We do not collect your card details. Those go directly to Stripe.",
        "We do not use advertising trackers or sell data to advertisers.",
        "We do not collect your contacts, location, camera or microphone.",
        "We do not build profiles for anyone other than you.",
      ],
    },
    {
      h: "Why we collect it",
      p: [
        "Your training data exists so the app can show you your progress, set the right difficulty, and keep your streak. That is its only purpose. Aggregated, anonymised figures may be used to improve the exercises, for example to check whether a level is too hard for most people.",
        "Your email and payment records exist so we can run your subscription and support you when something goes wrong.",
      ],
    },
    {
      h: "Who we share it with",
      p: [
        "Only the services needed to run the app:",
      ],
      list: [
        "Supabase, which hosts the database and handles sign-in.",
        "Vercel, which serves the application.",
        "Stripe, which processes payments.",
      ],
      after: [
        "Each of these is bound by its own contractual obligations to us. We do not sell your data, and we do not share it with anyone else unless the law requires it.",
      ],
    },
    {
      h: "Where it is stored",
      p: [
        "Our providers operate data centres in several countries, which means your data may be processed outside the country you live in. Where that happens, we rely on the standard contractual protections those providers offer.",
      ],
    },
    {
      h: "How long we keep it",
      p: [
        "Your account data and training history are kept while your account exists. If you delete your account, we delete them within 30 days, except where we are legally required to keep billing records for longer. Error logs are kept for 90 days.",
      ],
    },
    {
      h: "Your rights",
      p: [
        "You can ask us to give you a copy of your data, correct it, or delete it. You can withdraw consent to marketing at any time. Email " +
          LEGAL_CONTACT + " and we will respond within 30 days. If you are unhappy with how we handle a request, you can complain to your local privacy regulator.",
      ],
    },
    {
      h: "Cookies and local storage",
      p: [
        "We store a sign-in token so you are not asked to log in on every visit, and we keep some of your preferences in your browser's local storage. Neither is used for tracking or advertising. Clearing your browser data will sign you out and reset local preferences, but your account and training history stay safe on the server.",
      ],
    },
    {
      h: "Children",
      p: [
        "Cortex is not intended for children under 16, and we do not knowingly collect data from them. If you believe a child has created an account, tell us and we will remove it.",
      ],
    },
    {
      h: "Security",
      p: [
        "Data is encrypted in transit and at rest by our providers, and access is limited to those who need it. No system is perfectly secure. If a breach affects your data, we will tell you and the relevant regulator as the law requires.",
      ],
    },
    {
      h: "Changes",
      p: [
        "If we change this policy in a way that matters, we will tell you in the app or by email before it takes effect. The date at the top always reflects the current version.",
      ],
    },
  ],
};

const TERMS_OF_SERVICE = {
  title: "Terms of Service",
  intro:
    "These terms are the agreement between you and Cortex. By creating an account you accept them.",
  sections: [
    {
      h: "The service",
      p: [
        "Cortex provides cognitive training exercises and tracks your performance in them. We may add, change or remove exercises and features over time. We aim to keep the app available but we do not promise uninterrupted service.",
      ],
    },
    {
      h: "What Cortex is not",
      p: [
        "Cortex is a training tool, not a medical device, a diagnostic instrument, or a substitute for professional care.",
        "The levels and scores in the app measure your performance on these specific exercises. They are not IQ scores, clinical assessments, or measurements of your intelligence, and they should not be treated as such. Any figure the app calls an estimate is exactly that.",
        "We make no promise about how training here will affect your performance at anything outside the app. Whether cognitive training transfers to everyday ability is an open question in the research literature, and we do not claim to have settled it.",
        "If you have concerns about your memory, attention or cognition, speak to a doctor rather than relying on this app.",
      ],
    },
    {
      h: "Your account",
      p: [
        "You are responsible for keeping your sign-in details secure and for what happens under your account. One account is for one person. Tell us promptly if you think someone else has access to it.",
      ],
    },
    {
      h: "Subscriptions and payment",
      list: [
        "Paid plans are billed in advance, monthly or annually, through Stripe.",
        "Subscriptions renew automatically until you cancel.",
        "You can cancel at any time from your account. Cancelling stops future charges and your access continues to the end of the period you have already paid for.",
        "Prices may change. If they do, we will tell you before the change applies to you, and you can cancel instead.",
        "Where the law where you live gives you a right to a refund or a cooling-off period, that right applies regardless of anything else in these terms.",
      ],
    },
    {
      h: "Acceptable use",
      p: ["Do not:"],
      list: [
        "Break into, probe or disrupt the service or anyone else's account.",
        "Copy, scrape, resell or redistribute the app or its content.",
        "Share one account between several people, or resell access.",
        "Use the app to break the law.",
      ],
      after: [
        "We may suspend or close an account that does any of these.",
      ],
    },
    {
      h: "Your content",
      p: [
        "Your training data is yours. You give us the permission we need to store and process it in order to run the service, as described in the Privacy Policy, and nothing more.",
      ],
    },
    {
      h: "Our content",
      p: [
        "The app, its exercises, code, audio, artwork and text belong to us or our licensors. Your subscription buys you the right to use them personally, not to own or redistribute them.",
      ],
    },
    {
      h: "Ending the agreement",
      p: [
        "You can close your account whenever you like. We can end or suspend your access if you break these terms, or with reasonable notice if we stop offering the service. If we stop offering it, we will refund the unused portion of anything you have prepaid.",
      ],
    },
    {
      h: "Liability",
      p: [
        "The service is provided as it is. To the extent the law allows, we are not liable for indirect or consequential loss, and our total liability to you is limited to what you have paid us in the twelve months before the claim.",
        "Nothing in these terms excludes rights you have under consumer protection law that cannot be excluded.",
      ],
    },
    {
      h: "Changes to these terms",
      p: [
        "We may update these terms. If a change materially affects you, we will tell you before it takes effect, and continuing to use the app afterwards means you accept it.",
      ],
    },
    {
      h: "Governing law",
      p: [
        "These terms are governed by the law of New Zealand, and the courts of New Zealand have jurisdiction, without affecting any right you have to bring a claim where you live.",
      ],
    },
    {
      h: "Contact",
      p: ["Questions about these terms: " + LEGAL_CONTACT + "."],
    },
  ],
};

// Renders either document. Reading-width column, numbered sections, back to
// Account — the same shape as every other secondary screen in the app.
function LegalPage({ doc, onBack }) {
  return (
    <div className="space-y-10" style={{ maxWidth: "42rem" }}>
      <div>
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
        >
          &lsaquo; Back
        </button>
        <h1 className="text-4xl font-semibold tracking-tight">{doc.title}</h1>
        <div className="text-slate-500 text-sm mt-2">
          Last updated {LEGAL_UPDATED}
        </div>
        <p className="text-slate-300 text-base mt-5">{doc.intro}</p>
      </div>

      <div className="space-y-9">
        {doc.sections.map((sec, i) => (
          <section key={sec.h} className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100 flex gap-3">
              <span className="text-slate-600 tabular-nums font-medium">
                {String(i + 1).padStart(2, "0")}
              </span>
              {sec.h}
            </h2>
            {(sec.p || []).map((para) => (
              <p key={para} className="text-slate-400 text-base leading-relaxed">
                {para}
              </p>
            ))}
            {sec.list && (
              <ul className="space-y-1.5">
                {sec.list.map((item) => (
                  <li
                    key={item}
                    className="text-slate-400 text-base leading-relaxed pl-5 relative"
                  >
                    <span className="absolute left-0 top-2.5 w-1.5 h-1.5 rounded-full bg-slate-600" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {(sec.after || []).map((para) => (
              <p key={para} className="text-slate-400 text-base leading-relaxed">
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="pt-6 border-t border-slate-800/80 text-slate-500 text-sm">
        Questions: <span className="underline underline-offset-2">{LEGAL_CONTACT}</span>
      </div>
    </div>
  );
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
        <div className="text-sm font-medium uppercase tracking-wide text-slate-300 mb-2">
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
  { id: "panda", emoji: "🐼", bg: "#6E7178" },
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
  { id: "splitTone", label: "Split Tone", unlockedBy: "streak365" },
  { id: "aura", label: "Aura", unlockedBy: "streak180" },
];
const PROFILE_COLOR_OPTIONS = [
  { id: "indigo", label: "Indigo", unlockedBy: null },
  { id: "violet", label: "Violet", unlockedBy: "dualAdept" },
  { id: "cyan", label: "Cyan", unlockedBy: "streak14" },
  { id: "amber", label: "Amber", unlockedBy: "streak30" },
  { id: "rose", label: "Rose", unlockedBy: "streak90" },
  { id: "emerald", label: "Emerald", unlockedBy: "streak365" },
];
const PROFILE_BACKGROUND_OPTIONS = [
  { id: "none", label: "Default", unlockedBy: null, grad: "from-slate-800 to-slate-900" },
  { id: "aurora", label: "Aurora", unlockedBy: "regimeStreak7", grad: "from-indigo-600/50 via-violet-600/40 to-fuchsia-600/40" },
  { id: "sunrise", label: "Sunrise", unlockedBy: "streak30", grad: "from-amber-500/50 via-orange-500/40 to-rose-500/40" },
  { id: "deepSea", label: "Deep Sea", unlockedBy: "streak90", grad: "from-cyan-600/50 via-sky-600/40 to-blue-700/40" },
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

// Placeholder only — real per-exercise tutorial copy/walkthrough content
// goes here later. Keyed the same way so each exercise still gets its own
// tutorial screen in the flow.
const TUTORIAL_CONTENT = {
  dual: "🚧 Tutorial placeholder: Dual N-Back instructions go here.",
  quad: "🚧 Tutorial placeholder: Quad N-Back instructions go here.",
  rrt: "🚧 Tutorial placeholder: Relational Reasoning Training instructions go here.",
  iqnb: "🚧 Tutorial placeholder: IQ N-Back instructions go here.",
  motion3d: "🚧 Tutorial placeholder: 3D MOT instructions go here.",
};

// Rough draft placeholder leaderboard data — no real backend/accounts yet.
// dual/quad rank by N-back level (accuracy-based, with the accuracy at their
// personal-best level shown alongside it); rrt/iqnb/motion3d rank by their
// own score unit (points / decimal) even though `level` still drives which
// gem tier is shown.
//
// Tiers line up across boards: whatever a Dual N-Back level N shows, the
// equivalent rung elsewhere shows the same gem — QNB' 10.00, RRT 10p and
// 3D Motion tier 10 are all Enlightened, same as D10B. Each board walks its
// own ladder top to bottom, from that exercise's EXERCISE_LIBRARY maxN down.
//
// RRT: the tier is the premise count, so a 10p run is level 10 whatever the
// time on it — the seconds only tiebreak the score, never the rank. Scores
// encode as premises + seconds/100, which formatScoreValue renders as
// "10p 20s", and only real 5p-10p at 30s/25s/20s combinations appear.
const LEADERBOARD_DATA = {
  dual: [
    { name: "Ava", level: 10, accuracy: 93 },
    { name: "Marcus", level: 9, accuracy: 91 },
    { name: "Priya", level: 8, accuracy: 90 },
    { name: "Diego", level: 7, accuracy: 88 },
    { name: "Sofia", level: 6, accuracy: 87 },
    { name: "Jamal", level: 5, accuracy: 85 },
    { name: "You", level: 4, accuracy: 84 },
    { name: "Noah", level: 3, accuracy: 83 },
    { name: "Zara", level: 2, accuracy: 81 },
    { name: "Kenji", level: 1, accuracy: 80 },
  ],
  quad: [
    { name: "Ava", level: 10, accuracy: 93 },
    { name: "Marcus", level: 9, accuracy: 91 },
    { name: "Priya", level: 8, accuracy: 90 },
    { name: "Diego", level: 7, accuracy: 88 },
    { name: "Sofia", level: 6, accuracy: 87 },
    { name: "Jamal", level: 5, accuracy: 85 },
    { name: "You", level: 4, accuracy: 84 },
    { name: "Noah", level: 3, accuracy: 83 },
    { name: "Zara", level: 2, accuracy: 81 },
    { name: "Kenji", level: 1, accuracy: 80 },
  ],
  rrt: [
    { name: "Ava", level: 10, score: 10.20 },
    { name: "Marcus", level: 9, score: 9.20 },
    { name: "Priya", level: 8, score: 8.25 },
    { name: "You", level: 7, score: 7.20 },
    { name: "Diego", level: 6, score: 6.30 },
    { name: "Sofia", level: 5, score: 5.25 },
  ],
  iqnb: [
    { name: "Ava", level: 10, score: 10.00 },
    { name: "Marcus", level: 9, score: 9.00 },
    { name: "Priya", level: 8, score: 8.00 },
    { name: "Diego", level: 7, score: 7.00 },
    { name: "Sofia", level: 6, score: 6.00 },
    { name: "Jamal", level: 5, score: 5.00 },
    { name: "You", level: 4, score: 4.00 },
    { name: "Noah", level: 3, score: 3.00 },
    { name: "Zara", level: 2, score: 2.00 },
    { name: "Kenji", level: 1, score: 1.00 },
  ],
  motion3d: [
    { name: "Ava", level: 10, score: 1.05 },
    { name: "Marcus", level: 9, score: 0.95 },
    { name: "Priya", level: 8, score: 0.85 },
    { name: "Diego", level: 7, score: 0.75 },
    { name: "Sofia", level: 6, score: 0.65 },
    { name: "Jamal", level: 5, score: 0.55 },
    { name: "You", level: 4, score: 0.45 },
    { name: "Noah", level: 3, score: 0.35 },
    { name: "Zara", level: 2, score: 0.25 },
    { name: "Kenji", level: 1, score: 0.15 },
  ],
};

// Rough draft achievement catalog, organized into four groups. Each entry is
// computed live from real state (exerciseHistory / exerciseStats), not mock
// data. `progress` is optional flavor text shown while still locked; `reward`
// is optional flavor text (shown in italics) describing what unlocking it
// actually gives you — most of these rewards aren't wired up to anything yet.
// Which exercise an achievement belongs to. Prefers the explicit `exercise`
// field the level-achievement generators set, and otherwise falls back to the
// id prefix, which is how the hand-written per-exercise ones (dualMaster,
// qnbPrimeAdept, …) identify themselves.
const ACHIEVEMENT_ID_PREFIXES = {
  dual: "dual",
  quad: "quad",
  rrt: "rrt",
  iqnb: "qnbPrime",
  motion3d: "motion3d",
};
function exerciseKeyFor(a) {
  if (a.exercise) return a.exercise;
  const hit = Object.entries(ACHIEVEMENT_ID_PREFIXES).find(
    ([, prefix]) => a.id.startsWith(prefix)
  );
  return hit ? hit[0] : null;
}

// Top-level rows: one per exercise that has achievements, in EXERCISE_LIBRARY
// order, plus a "General" bucket for the ones that aren't exercise-specific.
function achievementExerciseSections() {
  const sections = [];
  const general = ACHIEVEMENTS_CATALOG.filter((a) => !exerciseKeyFor(a));
  if (general.length) {
    sections.push({ key: "general", label: "General", items: general });
  }
  Object.keys(EXERCISE_LIBRARY).forEach((key) => {
    const items = ACHIEVEMENTS_CATALOG.filter((a) => exerciseKeyFor(a) === key);
    if (items.length) {
      sections.push({ key, label: EXERCISE_LIBRARY[key].title, items });
    }
  });
  return sections;
}

// Second level: the achievement groups present within one exercise's list.
function achievementGroupSectionsFor(items) {
  const sections = ["Consistency", "Performance", "Variety", "Volume"]
    .map((group) => ({
      key: group,
      label: group,
      items: items.filter((a) => a.group === group),
    }))
    .filter((section) => section.items.length);
  // One group only — drop the redundant inner header and show the list.
  if (sections.length === 1) return [{ ...sections[0], label: null }];
  return sections;
}

// Splits one achievement group into an untagged block plus one block per
// exercise that has achievements in it, keeping EXERCISE_LIBRARY's order.
function achievementSectionsFor(group) {
  const inGroup = ACHIEVEMENTS_CATALOG.filter((a) => a.group === group);
  const sections = [];
  const untagged = inGroup.filter((a) => !exerciseKeyFor(a));
  if (untagged.length) sections.push({ key: "_", label: null, items: untagged });
  Object.keys(EXERCISE_LIBRARY).forEach((key) => {
    const items = inGroup.filter((a) => exerciseKeyFor(a) === key);
    if (items.length) {
      sections.push({ key, label: EXERCISE_LIBRARY[key].title, items });
    }
  });
  return sections;
}

const GROUP_ACCENTS = {
  Consistency: "indigo",
  Performance: "indigo",
  Variety: "indigo",
  Volume: "indigo",
};
// Raw hex counterparts of ACCENT_STYLES' Tailwind classes — for spots that
// need an actual CSS color value (inline conic-gradients, box-shadow glows
// via a --glow-color custom property, etc.) rather than a class name.
const ACCENT_HEX = {
  indigo: "#4CB9D8",
  violet: "#8B7FE8",
  amber: "#D9B65A",
  cyan: "#4CB9D8",
  rose: "#EB5757",
  lime: "#68CC58",
  emerald: "#4CB782",
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
const ACHIEVEMENT_EXERCISE_NAMES = {
  dual: "Dual N-Back",
  quad: "Quad N-Back",
  iqnb: "Quad N-Back Prime",
  rrt: "Relational Reasoning Training",
  motion3d: "3D MOT",
};

function nBackLevelAchievement(exerciseKey, level, overrides = {}) {
  const ex = EXERCISE_LIBRARY[exerciseKey];
  const levelTitle = ex.title.replace("N-Back", `${level}-Back`); // e.g. "Dual 5-Back"
  // Spelled-out names, not the stripped or abbreviated ones. "Dual Adept"
  // read as a typo and "QNB' Adept" means nothing to a new user, so the
  // achievement list says which exercise the rank actually belongs to.
  // Only achievement titles use these; the short labels stay everywhere
  // space is tight, like the home cards and leaderboard.
  const exerciseName = ACHIEVEMENT_EXERCISE_NAMES[exerciseKey] || ex.title;
  const tierTitle = `${exerciseName} ${gemTierFor(level).label}`; // e.g. "Dual N-Back Adept"
  const isMax = level === ex.maxN;
  return {
    id: `${exerciseKey}Level${level}`,
    exercise: exerciseKey,
    // The rank in the title is the same rank the leaderboard shows, so it
    // carries the same colour there as it does here.
    tierColor: gemTierFor(level).color,
    tierLabel: gemTierFor(level).label,
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
    exercise: "iqnb",
    group: "Performance",
    icon: "🌀",
    title: `QNB' ${gemTierFor(level).label}`,
    description: `Reach QNB' ${level}.00 for the first time.`,
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
    exercise: "rrt",
    group: "Performance",
    icon: "🔗",
    title: `RRT ${gemTierFor(level).label}`,
    description: `Reach RRT ${premiseCount}p for the first time.`,
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
    exercise: "motion3d",
    group: "Performance",
    icon: "👁️",
    title: `3D MOT ${gemTierFor(level).label}`,
    description: `Reach 3D MOT tier ${level} for the first time.`,
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
  // Consistency — major milestones only
  {
    id: "regimeStreak7",
    group: "Consistency",
    icon: "🔥",
    title: "1 Week",
    description: "Complete your regime 7 days in a row without missing a day.",
    reward: "1 month free membership · Glow avatar border",
    unlocked: (s) => s.regimeStreak >= 7,
    progress: (s) => `${Math.min(s.regimeStreak, 7)}/7 days`,
  },
  {
    id: "streak14",
    group: "Consistency",
    icon: "🔥",
    title: "2 Weeks",
    description: "Train 14 days in a row.",
    unlocked: (s) => s.streak >= 14,
    progress: (s) => `${Math.min(s.streak, 14)}/14 days`,
  },
  {
    id: "streak30",
    group: "Consistency",
    icon: "🔥",
    title: "1 Month",
    description: "Train 30 days in a row.",
    reward: "Unlocks the Custom regime option",
    unlocked: (s) => s.streak >= 30,
    progress: (s) => `${Math.min(s.streak, 30)}/30 days`,
  },
  {
    id: "streak90",
    group: "Consistency",
    icon: "🔥",
    title: "3 Months",
    description: "Train 90 days in a row.",
    unlocked: (s) => s.streak >= 90,
    progress: (s) => `${Math.min(s.streak, 90)}/90 days`,
  },
  {
    id: "streak180",
    group: "Consistency",
    icon: "🔥",
    title: "6 Months",
    description: "Train 180 days in a row.",
    reward: "Animated aura around your avatar",
    unlocked: (s) => s.streak >= 180,
    progress: (s) => `${Math.min(s.streak, 180)}/180 days`,
  },
  {
    id: "streak365",
    group: "Consistency",
    icon: "🔥",
    title: "1 Year",
    description: "Train 365 days in a row.",
    unlocked: (s) => s.streak >= 365,
    progress: (s) => `${Math.min(s.streak, 365)}/365 days`,
  },
  {
    id: "streak730",
    group: "Consistency",
    icon: "🔥",
    title: "2 Years",
    description: "Train 730 days in a row.",
    unlocked: (s) => s.streak >= 730,
    progress: (s) => `${Math.min(s.streak, 730)}/730 days`,
  },
  {
    id: "streak1095",
    group: "Consistency",
    icon: "🔥",
    title: "3 Years",
    description: "Train 1095 days in a row.",
    unlocked: (s) => s.streak >= 1095,
    progress: (s) => `${Math.min(s.streak, 1095)}/1095 days`,
  },

  // Performance — per-exercise level ladders
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
  if (unlockedIds.has("streak365")) return "splitTone";
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
  const rrtScrambleFactor = RRT_SCRAMBLE_FACTOR;
  const [switchNotice, setSwitchNotice] = useState(false);
  const [switchQuote, setSwitchQuote] = useState("");
  // Lines already shown this session. A plain random pick repeated itself
  // inside a single four-exercise regime often enough to be noticed, which
  // makes the whole thing read as canned. Draws only from what is left, and
  // starts over once the pool is exhausted.
  const usedQuotesRef = useRef(new Set());
  const nextTransitionQuote = () => {
    let pool = TRANSITION_QUOTES.filter((q) => !usedQuotesRef.current.has(q));
    if (pool.length === 0) {
      usedQuotesRef.current.clear();
      pool = TRANSITION_QUOTES;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    usedQuotesRef.current.add(pick);
    return pick;
  };
  // Chance (0-32%) that a non-match trial is a "lure" reusing the item from
  // n-1 or n+1 trials back instead of a fresh one, so it superficially
  // resembles a recent repeat without actually being the n-back match.
  // Defaults on at 12% for every n-back exercise so sessions actually
  // include confusable near-misses out of the box. QNB' overrides this
  // per-run with its own progression (see qnbPrimeSettingsFor) instead of
  // using this shared value.
  // Not persisted; resets to this default on reload. Stored as a fraction
  // (0-0.32) internally, shown as a whole-percent slider in the UI.
  const interference = NBACK_INTERFERENCE;
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
  // Which block of the current sitting the Results screen is reporting on.
  // Resets whenever the exercise changes so each one counts from 1.
  const [roundNumber, setRoundNumber] = useState(1);
  const [feedback, setFeedback] = useState({});
  const [lowScoreStreak, setLowScoreStreak] = useState({});
  const [levelChangeNotice, setLevelChangeNotice] = useState(null); // { direction: "down" } — level dropped after 3 failing runs
  const [newPRBanners, setNewPRBanners] = useState({}); // { [exerciseKey]: title } — shown as boxes on the results screen only, cleared when that exercise is (re)started
  const [unlockInfo, setUnlockInfo] = useState(null); // { exerciseKey, level, title } — drives the "new emblem unlocked" overlay (see the fixed-position block near the other celebration overlays, not a mainView)
  const [profileTarget, setProfileTarget] = useState(null); // "you" | <leaderboard name> | null — who the Profile screen is showing
  const [achievementCelebrationQueue, setAchievementCelebrationQueue] = useState([]); // ACHIEVEMENTS_CATALOG entries just unlocked, shown one at a time as a full-screen celebration
  const [openAchievementSections, setOpenAchievementSections] = useState(() => new Set()); // "group:exerciseKey" ids of the expanded per-exercise achievement lists — collapsed by default so the page is a short index instead of one long scroll
  const [simulatedUnlockedIds, setSimulatedUnlockedIds] = useState(() => new Set());
  const toggleAchievementSection = (id) =>
    setOpenAchievementSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }); // achievement ids force-unlocked via the per-badge 🧪 Simulate button, independent of real progress
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
  const exerciseElapsedMsRef = useRef({}); // mirrors the above for callbacks that need it synchronously
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
  // True only on the end-of-regime path, where Motivation is the last step
  // of the session. Opened from Home it is just a page. Inferring this from
  // overviewSource was wrong: that value is stale when Motivation is opened
  // straight from Home without passing through the Overview screen.
  const [hypnosisAfterSession, setHypnosisAfterSession] = useState(false);
  const [overviewSource, setOverviewSource] = useState("training"); // "training" | "home" — controls which time-trained stat the Session Overview screen shows
  // Plays for a beat between finishing a regime and landing on Motivation,
  // so the end of a session registers as an event rather than a page change.
  const [sessionCompleteAnim, setSessionCompleteAnim] = useState(false);
  // Set only by the preview buttons; null means "work it out from the data".
  const [nudgeIdOverride, setNudgeIdOverride] = useState(null);
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
  const [binauralBeatsEnabled, setBinauralBeatsEnabledState] = useState(true); // persisted — on by default, switched off from the Account page
  const [badgesExpanded, setBadgesExpanded] = useState(false); // Account page — Badges row toggles the grid open in place
  const [customizeExpanded, setCustomizeExpanded] = useState(false); // Account page — Customize profile row toggles avatar/frame/color/background/featured-badge pickers open in place
  const [profileBadgesExpanded, setProfileBadgesExpanded] = useState(false); // Profile page — same toggle pattern as Account
  const [membershipPlan, setMembershipPlan] = useState("monthly"); // "monthly" | "annual" | "canceled" — mirrors billing.plan for the Account row; the source of truth is `billing` below
  // Seeded from the last known state so the Membership screen paints real
  // numbers the moment it opens, even on the very first visit of a session.
  // The live fetch still runs and overwrites this; the cache only removes
  // the empty first frame.
  const [billingState, setBillingState] = useState(() => {
    try {
      const raw = localStorage.getItem("cortex.billingState");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [billingLoading, setBillingLoading] = useState(true);
  const billingLoadedRef = useRef(false);
  const [billingError, setBillingError] = useState("");
  const [previewData, setPreviewData] = useState(null); // proration preview shown before confirming a plan switch
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTargetPlan, setPreviewTargetPlan] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [cancelComment, setCancelComment] = useState("");
  const [setupClientSecret, setSetupClientSecret] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [cardUpdateSaved, setCardUpdateSaved] = useState(false);

  // Every /api/billing/* call goes through here — attaches the person's
  // real Supabase auth token so the backend can verify who's asking and
  // derive their Stripe customer id itself, rather than trusting anything
  // the client claims about which customer/subscription it is.
  // Wraps setBillingState so every fresh response is also cached for the
  // next visit. Wrapped in try/catch because private-mode browsers throw
  // on localStorage rather than just returning null.
  const applyBillingState = useCallback((data) => {
    setBillingState(data);
    try {
      if (data) localStorage.setItem("cortex.billingState", JSON.stringify(data));
    } catch {
      // storage unavailable, the page still works without the cache
    }
  }, []);

  const callBillingApi = useCallback(async (path, body) => {
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    const res = await fetch(`/api/billing/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authSession?.access_token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }, []);

  // Fetched once as soon as the app is up, then refreshed each time the
  // Membership screen is opened. Because the first fetch has already
  // landed by then, opening Membership renders the real numbers straight
  // away — the refresh happens silently behind the already-drawn page
  // instead of replacing it with "Loading your subscription…".
  useEffect(() => {
    if (mainView !== "membership" && billingLoadedRef.current) return;
    let cancelled = false;
    if (!billingLoadedRef.current) setBillingLoading(true);
    setBillingError("");
    // One-shot confirmation — it belongs to the update the person just did,
    // not to every later visit. Leaving Membership and coming back clears it.
    setCardUpdateSaved(false);
    setSetupError("");
    callBillingApi("state")
      .then((data) => {
        if (!cancelled) {
          applyBillingState(data);
          billingLoadedRef.current = true;
        }
      })
      .catch((err) => {
        if (!cancelled) setBillingError(err.message);
      })
      .finally(() => {
        if (!cancelled) setBillingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mainView, callBillingApi]);

  // The proration figures come from a Stripe round trip, so asking for them
  // at click time always meant a visible wait. They are fetched in the
  // background as soon as Membership opens instead, keyed by plan, so the
  // confirm box has its numbers ready before the button is pressed.
  const previewCacheRef = useRef({});

  useEffect(() => {
    // Not gated on the Membership screen being open. Waiting until it opened
    // left the very first click racing the fetch, which is exactly the
    // "only the first one lags" behaviour. Both directions are warmed as
    // soon as the billing state is known, so whichever button is pressed
    // first already has its numbers.
    if (!billingState) return;
    let cancelled = false;
    ["monthly", "annual"].forEach((target) => {
      if (target === billingState.plan) return;
      if (previewCacheRef.current[target]) return;
      callBillingApi("preview-switch", { plan: target })
        .then((data) => {
          if (!cancelled) previewCacheRef.current[target] = data;
        })
        .catch(() => {
          // Silent. The click-time fetch will surface any real error.
        });
    });
    return () => {
      cancelled = true;
    };
  }, [billingState, callBillingApi]);

  const handlePreviewSwitch = async (plan) => {
    setActionError("");
    setPreviewTargetPlan(plan);

    const cached = previewCacheRef.current[plan];
    if (cached) {
      setPreviewData(cached);
      setPreviewLoading(false);
      // Refresh behind the already-visible box. prorationDate drifts with
      // the clock, and the amount Stripe charges must match what was
      // confirmed, so a stale preview cannot be the one that gets used.
      callBillingApi("preview-switch", { plan })
        .then((fresh) => {
          previewCacheRef.current[plan] = fresh;
          setPreviewData((current) => (current === cached ? fresh : current));
        })
        .catch(() => {});
      return;
    }

    setPreviewLoading(true);
    try {
      const data = await callBillingApi("preview-switch", { plan });
      previewCacheRef.current[plan] = data;
      setPreviewData(data);
    } catch (err) {
      setActionError(err.message);
      setPreviewTargetPlan(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmSwitch = async () => {
    if (!previewTargetPlan || !previewData) return;
    setActionLoading(true);
    setActionError("");
    // Stale once the plan changes. Cleared rather than kept, but the effect
    // above rewarms both directions the moment the new billingState lands,
    // so the next click is still instant.
    previewCacheRef.current = {};
    try {
      const data = await callBillingApi("switch", {
        plan: previewTargetPlan,
        prorationDate: previewData.prorationDate,
      });
      applyBillingState(data);
      setPreviewData(null);
      setPreviewTargetPlan(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSwitch = () => {
    setPreviewData(null);
    setPreviewTargetPlan(null);
  };

  const handlePause = async (months = 1) => {
    setActionLoading(true);
    setActionError("");
    try {
      const data = await callBillingApi("pause", { months });
      applyBillingState(data);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const data = await callBillingApi("resume");
      applyBillingState(data);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const data = await callBillingApi("reactivate");
      applyBillingState(data);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubmit = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const data = await callBillingApi("cancel", {
        feedback: cancelFeedback,
        comment: cancelComment,
      });
      applyBillingState(data);
      setShowCancelForm(false);
      setCancelFeedback("");
      setCancelComment("");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryInvoice = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const data = await callBillingApi("retry-invoice");
      applyBillingState(data);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartCardUpdate = async () => {
    setSetupError("");
    setSetupLoading(true);
    setCardUpdateSaved(false);
    try {
      const data = await callBillingApi("setup-intent");
      setSetupClientSecret(data.clientSecret);
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setSetupLoading(false);
    }
  };
  
  const [hideTutorials, setHideTutorialsState] = useState(false); // persisted — global "skip every tutorial" override, toggled only via the Account page switch
  const hideTutorialsRef = useRef(false);
  useEffect(() => {
    hideTutorialsRef.current = hideTutorials;
  }, [hideTutorials]);
  const [dismissedTutorials, setDismissedTutorialsState] = useState({}); // persisted — { [exerciseKey]: true }, set via that exercise's own tutorial "Don't show this again" checkbox; only skips THAT exercise's tutorial, not every exercise's
  const dismissedTutorialsRef = useRef({});
  useEffect(() => {
    dismissedTutorialsRef.current = dismissedTutorials;
  }, [dismissedTutorials]);
  const [tutorialDontShowAgain, setTutorialDontShowAgain] = useState(false); // this run's checkbox state — reset to unchecked each time a fresh tutorial starts
  const currentRunStartRef = useRef(null);
  const avatarFileInputRef = useRef(null);
  // Was 200, which silently discarded a daily trainer's history after about
  // six months. The chart buckets long ranges now, so it can hold years.
  const MAX_HISTORY_ENTRIES = 5000;

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
        const res = await window.storage.get("hide-tutorials", false);
        if (res && res.value) {
          setHideTutorialsState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved tutorial preference yet
      }
      try {
        const res = await window.storage.get("dismissed-tutorials", false);
        if (res && res.value) {
          setDismissedTutorialsState(JSON.parse(res.value));
        }
      } catch (err) {
        // no saved per-exercise tutorial dismissals yet
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
      setAvatarUploadError("Couldn't load that image. Try a different file.");
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

  // Only actually plays while a trial is running — stops itself on setup/
  // results screens rather than droning on in the menus.
  const { unlock: unlockBinauralAudio, audioError: binauralAudioError } = useBinauralBeats(
    // The hand-off between exercises is still "in an exercise" as far as the
    // track is concerned; stopping it there made the audio cut out every few
    // minutes. A tutorial leaves mainView === "app", so that still stops it.
    binauralBeatsEnabled && mainView === "app" && exercise.key !== "overview"
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
          {
            ts: Date.now(),
            accuracy: scoreValue,
            n: levelReached,
            streak: streakReached ?? 0,
            durationMs,
          },
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

  const setHideTutorials = useCallback((val) => {
    setHideTutorialsState(val);
    if (window.storage) {
      safeStorageSet("hide-tutorials", JSON.stringify(val), false);
    }
  }, []);

  const setTutorialDismissed = useCallback((exerciseKey, val) => {
    setDismissedTutorialsState((prev) => {
      const next = { ...prev, [exerciseKey]: val };
      if (window.storage) {
        safeStorageSet("dismissed-tutorials", JSON.stringify(next), false);
      }
      return next;
    });
  }, []);

  const stopRunTimer = useCallback((exerciseKey) => {
    if (currentRunStartRef.current != null) {
      const elapsed = Date.now() - currentRunStartRef.current;
      currentRunStartRef.current = null;
      setExerciseElapsedMs((prev) => {
        const next = {
          ...prev,
          [exerciseKey]: (prev[exerciseKey] || 0) + elapsed,
        };
        exerciseElapsedMsRef.current = next;
        return next;
      });
      // A finished run writes its own duration into history, so that time
      // must not be logged again as abandoned.
      loggedElapsedRef.current[exerciseKey] =
        (exerciseElapsedMsRef.current[exerciseKey] || 0) + 0;
    }
  }, []);

  // How much of each exercise's elapsed time has already been written into
  // exerciseHistory by a completed run, so an abandoned session only logs
  // the part nobody has counted yet.
  const loggedElapsedRef = useRef({});

  // Someone who trains for twenty minutes and walks away before finishing
  // still did twenty minutes. Log it as a session with time but no score:
  // the spreadsheet shows it red, with the duration intact, instead of
  // pretending the day never happened.
  const logPartialSession = useCallback(
    (exerciseKey) => {
      if (!exerciseKey || exerciseKey === "overview") return;
      const total = exerciseElapsedMsRef.current[exerciseKey] || 0;
      const alreadyLogged = loggedElapsedRef.current[exerciseKey] || 0;
      const unlogged = total - alreadyLogged;
      // Below a minute is a glance, not a session.
      if (unlogged < 60 * 1000) return;
      loggedElapsedRef.current[exerciseKey] = total;
      setExerciseHistory((prev) => {
        const prevHistory = prev[exerciseKey] || [];
        const newHistory = [
          ...prevHistory,
          {
            ts: Date.now(),
            accuracy: null,
            n: null,
            durationMs: unlogged,
            partial: true,
          },
        ].slice(-MAX_HISTORY_ENTRIES);
        safeStorageSet(`history-${exerciseKey}`, JSON.stringify(newHistory), false);
        return { ...prev, [exerciseKey]: newHistory };
      });
    },
    []
  );

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
      // The record is reaching a level they have never reached, so it must
      // compare the level they are being promoted TO. Comparing the level
      // they just played meant the very next promotion never counted:
      // bestN had already been bumped to that number last time.
      const isNewPR = nextN > prevBestN;
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
      setRoundNumber((r) => r + 1);
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
      // Every route into an exercise passes through here — the setup
      // screen's Start, Continue on the results screen, the switch to the
      // next exercise in a regime, and the dev jump. Previously only
      // "Start Training" from Home unlocked and preloaded the recordings,
      // so any other entry fell back to speech synthesis for the whole
      // session.
      unlockLetterAudio();
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
      // QNB' draws from its own shape pool — polyominoes and pictograms —
      // rather than the basic polygons the other N-back exercises use. A
      // random eight per session, the way Brain Workshop picks a subset of a
      // set, so the shapes vary between sessions without changing how often
      // a match can occur.
      const runShapeSet = isQnbPrime ? pickQnbShapeSet(8) : null;
      if (isQnbPrime) preloadQnbPictograms();
      const seq = generateSequence(
        modalities,
        nn,
        tt,
        runInterference,
        runMatchChance,
        runShapeSet
      );
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

  // Dev/test only — used by Motion3DExercise's "🧪 Simulate 15 min
  // elapsed" button. Unlike forceSwitchToNext (which just steps to
  // whatever's immediately next in the regime — another real exercise if
  // motion3d isn't the last step), this always lands on the Overview
  // screen directly, since the point of the button is "show me what the
  // end of a session looks like" regardless of where motion3d happens to
  // sit in the current regime. Mirrors forceSwitchToNext's own real
  // end-of-regime handling (training-sourced overview + counts toward the
  // regime-streak) rather than goToOverview's plain "just go look" version
  // (which sources from "home" and doesn't touch the streak), since this
  // is standing in for that same real transition, just skipping ahead to it.
  const forceJumpToOverview = useCallback((fromIndex) => {
    if (exerciseIndexRef.current !== fromIndex) return; // already moved on
    const list = activeExercisesRef.current;
    const currentEx = list[fromIndex];
    clearTimeout(sessionTimersRef.current[currentEx.key]);
    runGenerationRef.current += 1;
    clearTimeout(timeoutRef.current);
    stopRunTimer(currentEx.key);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    const overviewIndex = list.findIndex((e) => e.key === "overview");
    if (overviewIndex === -1) return; // no overview step in this regime
    setExerciseIndex(overviewIndex);
    setScreen("setup");
    setOverviewView("summary");
    setOverviewSource("training");
    markRegimeCompletedToday();
  }, []);

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

    const nextExercise = list[nextIndex];
    // The Session Overview is the end of the regime, not another exercise.
    // Showing "Next exercise" in front of it was simply wrong, and it put a
    // four-second wait between finishing and seeing the result.
    const goingToOverview = nextExercise.key === "overview";

    if (!goingToOverview) {
      setSwitchNotice(true);
      setSwitchQuote(nextTransitionQuote());
    }
    setExerciseIndex(nextIndex);
    setScreen("setup");

    if (nextExercise.key === "overview") {
      // Landing on the Session Overview screen straight out of a training session —
      // show today's training time, not the lifetime total.
      setOverviewSource("training");
      // They've gone through every step of today's regime — count it toward
      // the 7-day regime-streak achievement.
      markRegimeCompletedToday();
    }
    const land = () => {
      setSwitchNotice(false);
      setN(exerciseLevelsRef.current[nextExercise.key] ?? nextExercise.defaultN);
      // Show this specific exercise's tutorial right before it starts — the
      // whole reason forceSwitchToNext is the second gate alongside
      // proceedStartFromHome: every exercise transition mid-session should
      // get its own tutorial screen, not just the very first one.
      if (
        !hideTutorialsRef.current &&
        !dismissedTutorialsRef.current[nextExercise.key] &&
        TUTORIAL_CONTENT[nextExercise.key]
      ) {
        setTutorialDontShowAgain(false);
        setMainView("tutorial");
      }
      // land on the setup screen for the next exercise; user presses Start themselves
    };
    if (goingToOverview) land();
    else setTimeout(land, 3500);
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

  // Stats is not scoped to the current regime. Training history is stored per
  // EXERCISE, never per regime, so switching from Quick to Balanced and back
  // never loses anything — but listing only the current regime's exercises
  // hid the rest, which looked exactly like data loss. This lists the current
  // regime's exercises first, then every other exercise that has any history,
  // so a run of Quick in August still shows after a September on Balanced.
  const statsExercises = (() => {
    const inRegime = new Set(currentRegime.steps.map((st) => st.key));
    const others = Object.values(EXERCISE_LIBRARY).filter(
      (e) =>
        e.key !== "overview" &&
        !inRegime.has(e.key) &&
        (exerciseHistory[e.key] || []).length > 0
    );
    return [...overviewExercises, ...others];
  })();

  // The tutorial now always shows for exactly the one exercise that's about
  // to start (gated in proceedStartFromHome / forceSwitchToNext below) —
  // no more walking through every exercise in the regime up front.
  const tutorialStepExercise = exercise;

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
  // The one line the session-complete screen shows. Recomputed on render,
  // which is fine: it is a handful of comparisons over data already in hand.
  const sessionNudgeLine = (() => {
    const todayKey = new Date().toDateString();
    let hitPRToday = false;
    let nearBest = false;
    let todayCount = 0;
    let todayAccSum = 0;
    let priorAccSum = 0;
    let priorCount = 0;
    Object.entries(exerciseHistory).forEach(([key, hist]) => {
      if (key.startsWith("_")) return;
      const stat = exerciseStats[key];
      (hist || []).forEach((h) => {
        const isToday = new Date(h.ts).toDateString() === todayKey;
        const acc = typeof h.accuracy === "number" ? h.accuracy : null;
        if (isToday) {
          todayCount++;
          if (acc != null) todayAccSum += acc;
          if (stat && typeof h.n === "number" && h.n >= (stat.bestN || 0)) {
            hitPRToday = true;
          }
        } else if (acc != null) {
          priorAccSum += acc;
          priorCount++;
        }
      });
      const level = exerciseLevels[key];
      if (stat && typeof level === "number" && stat.bestN && level === stat.bestN - 1) {
        nearBest = true;
      }
    });
    // Only judged when there is enough history for "better than usual" to
    // mean anything.
    let strongSession = null;
    if (todayCount > 0 && priorCount >= 5) {
      const todayAvg = todayAccSum / todayCount;
      const priorAvg = priorAccSum / priorCount;
      if (todayAvg >= priorAvg + 4) strongSession = true;
      else if (todayAvg <= priorAvg - 8) strongSession = false;
    }
    return sessionNudge(
      {
        streak: currentStreakDays(exerciseHistory, streakBrokenAt),
        longestStreak: longestStreakDays(exerciseHistory),
        totalSessions: Object.values(exerciseStats).reduce(
          (sum, v) => sum + (v?.sessions || 0),
          0
        ),
        hitPRToday,
        nearBest,
        strongSession,
        // Back after a gap: they trained today, and the day before had
        // nothing. Worth catching, because that is the session where people
        // decide whether the whole thing is over.
        returning: (() => {
          const days = trainedDateStrings(exerciseHistory);
          const y = new Date();
          y.setDate(y.getDate() - 1);
          return days.has(todayKey) && !days.has(y.toDateString());
        })(),
      },
      nudgeIdOverride
    );
  })();

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

  // Opening an exercise and backing straight out to Home leaves no timer
  // running, so sessionInProgress stays false and Home still offered
  // "Start Training" for a session already underway. This covers that gap:
  // the person is parked on an exercise, so the useful action is ending the
  // session rather than starting one.
  const sessionOpenedRef = useRef(false);
  useEffect(() => {
    if (mainView === "app" && exercise.key !== "overview") {
      sessionOpenedRef.current = true;
    }
  }, [mainView, exercise.key]);
  const sessionParked =
    !sessionInProgress &&
    sessionOpenedRef.current &&
    exercise.key !== "overview";

  // Drops straight back into whichever exercise they left, at the screen
  // and elapsed time they left it on — nothing about the session is reset.
  const continueSession = () => setMainView("app");

  // Spreadsheet paging — one page number per exercise, 20 rows a page.
  const [historyPage, setHistoryPage] = useState({});
  const HISTORY_PAGE_SIZE = 7;
  const SHEET_ROW_H = 44;

  // Dev/test only: fills every exercise with ~90 days of plausible history
  // so the table and graph can be judged at a realistic size rather than
  // with three rows in them.
  const seedFakeHistory = () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    Object.keys(EXERCISE_LIBRARY).forEach((key) => {
      const ex = EXERCISE_LIBRARY[key];
      if (!ex || key === "overview") return;
      const entries = [];
      let level = 2;

      // One session's score, generated per exercise in that exercise's own
      // format. Each session is generated whole rather than by nudging a
      // day's value, which was corrupting RRT's packed points-and-seconds
      // (a ±0.4 nudge pushed the decimals past .59 and rolled the points)
      // and pushing QNB' and 3D MOT past their real ranges.
      const sessionScore = (progress) => {
        if (ex.scoreType === "points") {
          // Premises solved in the whole part, round length in seconds in
          // the decimals — so the decimals must stay inside 0-59.
          const points = Math.max(
            1,
            Math.min(ex.maxN, Math.round(2 + progress * 5 + (Math.random() - 0.5) * 2))
          );
          const seconds = 10 + Math.floor(Math.random() * 40); // 10-49s
          return points + seconds / 100;
        }
        if (key === "iqnb") {
          // QNB' climbs in hundredths from its starting level.
          const lvl = 2.5 + progress * 2.5 + (Math.random() - 0.5) * 0.5;
          return Math.round(Math.min(ex.maxN, Math.max(1, lvl)) * 100) / 100;
        }
        if (key === "motion3d") {
          // 3D MOT is a ball speed, and a low one — it was reading as a
          // level number before, which is why it looked far too high.
          const spd = 0.6 + progress * 1.5 + (Math.random() - 0.5) * 0.35;
          return Math.round(Math.max(0.2, spd) * 100) / 100;
        }
        // N-back exercises score a hit rate.
        return Math.max(
          30,
          Math.min(99, Math.round(52 + progress * 34 + (Math.random() - 0.5) * 16))
        );
      };

      for (let back = 90; back >= 0; back--) {
        // A believable gap rate, so the table shows real missed days.
        if (Math.random() < 0.22) continue;
        level = Math.min(ex.maxN, level + (Math.random() < 0.06 ? 1 : 0));
        // Real practice plateaus, so the ramp tails off rather than rising
        // smoothly to the end and making every day a new record.
        const progress = Math.min(1, ((90 - back) / 90) * 1.25);
        // Some days get two sessions, so a day's average is genuinely
        // different from its best and the two record columns can diverge.
        const sessionsToday = Math.random() < 0.3 ? 2 : 1;
        for (let k = 0; k < sessionsToday; k++) {
          entries.push({
            ts: now - back * dayMs + k * 60 * 60 * 1000,
            accuracy: sessionScore(progress),
            n: level,
            streak:
              ex.scoreType === "points"
                ? Math.max(0, Math.min(20, Math.round(4 + progress * 12 + (Math.random() - 0.5) * 6)))
                : undefined,
            durationMs: Math.round((8 + Math.random() * 22) * 60 * 1000),
          });
        }
      }
      setExerciseHistory((prev) => ({ ...prev, [key]: entries }));
      safeStorageSet(`history-${key}`, JSON.stringify(entries), false);
    });
    setHistoryPage({});
  };

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
    sessionOpenedRef.current = false;
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
    unlockLetterAudio();
    // If we're currently parked on the overview "exercise" (e.g. from a
    // previous visit), land on the first exercise in the regime instead of it
    // — restoring whatever level they'd actually reached there, not always
    // resetting back to that exercise's starting default.
    let targetExercise = exercise;
    if (exercise.key === "overview") {
      setExerciseIndex(0);
      targetExercise = activeExercises[0];
      setN(exerciseLevelsRef.current[targetExercise.key] ?? targetExercise.defaultN);
    }
    setScreen("setup");
    if (!hideTutorials && !dismissedTutorials[targetExercise.key] && TUTORIAL_CONTENT[targetExercise.key]) {
      setTutorialDontShowAgain(false);
      setMainView("tutorial");
    } else {
      setMainView("app");
    }
  };

  // 🧪 Dev/test shortcut — jump straight to any exercise's setup screen,
  // skipping regime selection and the Start Training flow entirely. Swaps
  // activeExercises down to just the one chosen exercise (so there's
  // nothing to auto-advance to afterward — this is a one-off test run, not
  // a real session), and restores whatever level was actually last reached
  // for it, same as the normal flow does.
  const jumpToExercise = (key) => {
    const ex = EXERCISE_LIBRARY[key];
    if (!ex) return;
    setActiveExercises([ex, OVERVIEW_EXERCISE]);
    setExerciseIndex(0);
    setN(exerciseLevelsRef.current[key] ?? ex.defaultN);
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
    sessionOpenedRef.current = false;
    setRegimeKey(key);
    setActiveExercises(built);
    setExerciseIndex(0);
    // The level already reached in that exercise, not the exercise's static
    // default. Switching regime and coming back used to drop the first
    // exercise to its starting level, which read as the old progress being
    // gone even though the stored history was untouched.
    setN(exerciseLevelsRef.current[built[0].key] ?? built[0].defaultN);
    setScreen("setup");
    setSwitchNotice(false);
    setLevelChangeNotice(null);
    setMainView("home");
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

  // Each exercise counts its own rounds from 1.
  useEffect(() => {
    setRoundNumber(1);
  }, [exercise.key]);

  // Second chance to have the recordings ready: sitting on an exercise's
  // setup screen is a good few seconds before Start is pressed.
  useEffect(() => {
    if (mainView === "app" && exercise.key !== "overview") preloadLetterAudio();
  }, [mainView, exercise.key]);

  useEffect(() => {
    exerciseElapsedMsRef.current = exerciseElapsedMs;
  }, [exerciseElapsedMs]);

  // Quad N-Back record reveal, driven by a timer rather than a long CSS
  // animation-delay. A delay that big is fragile: any re-render restarts it
  // and the screen sits in its blurred opening frame indefinitely.
  // The whole app scrolls inside one container, so moving between screens
  // kept whatever scroll position the last one was left at — which is why a
  // long page opened partway down. Reset it on every change of view.
  const [rrtAutoStart, setRrtAutoStart] = useState(0);
  const scrollRootRef = useRef(null);
  useEffect(() => {
    if (scrollRootRef.current) scrollRootRef.current.scrollTop = 0;
    // Some browsers scroll the document rather than the container, depending
    // on where the overflow actually resolves.
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [mainView, screen, overviewView]);

  // Which Home card is mid-shine. One at a time; cleared when its sweep
  // finishes so the same card can be pressed again straight away.
  const [shineCard, setShineCard] = useState(null);
  const [prRevealed, setPrRevealed] = useState(false);
  const [prGlowOut, setPrGlowOut] = useState(false);
  // Every exercise's record gets the full reveal, not just Quad's. A record
  // is a record whichever screen it came off.
  const prCinematic = !!unlockInfo && unlockInfo.isNewPR;
  useEffect(() => {
    if (!prCinematic) {
      setPrRevealed(false);
      return undefined;
    }
    setPrRevealed(false);
    setPrGlowOut(false);
    const t = setTimeout(() => setPrRevealed(true), 4700);
    // The song plays SONG_START..SONG_FADE_OUT_AT and then fades over
    // SONG_FADE_OUT. The glow starts its own fade at the same moment and
    // over the same span, so the light and the music leave together.
    const g = setTimeout(
      () => setPrGlowOut(true),
      (SONG_FADE_OUT_AT - SONG_START) * 1000
    );
    return () => {
      clearTimeout(t);
      clearTimeout(g);
    };
  }, [prCinematic, unlockInfo]);

  // Fetch and decode the applause once, up front, so the first record of a
  // session is not the one that misses it.
  useEffect(() => {
    preloadCheer();
    preloadSong();
  }, []);

  // The one sound in the app that celebrates something. Fires when the
  // level-up overlay opens, and nowhere else.
  // Achievements get the short tune. Reaching a level for the first time is
  // the only thing that gets the track and the full reveal, so the two never
  // fight over the moment.
  const pendingAchievement = achievementCelebrationQueue[0];
  useEffect(() => {
    if (pendingAchievement) playLevelUp();
  }, [pendingAchievement]);

  // Reaching a level for the FIRST time gets the celebration track and the
  // applause. Climbing back to a level already reached before gets the short
  // tune instead, so the big moment stays rare enough to mean something.
  useEffect(() => {
    if (!unlockInfo) return;
    if (unlockInfo.isNewPR) {
      const playing = playCelebrationSong();
      if (!playing && songFailed) playLevelUp();
      playCheer();
      return;
    }
    playLevelUp();
  }, [unlockInfo]);

  // The running screen's answer buttons, split into a left and a right
  // column. Modalities alternate sides in their declared order, so Dual
  // N-Back gets one button per hand and Quad gets two.
  const nbackSideButtons = useMemo(() => {
    // Fixed sides, so a modality never moves between exercises: the visual
    // streams sit on the left, the audio stream on the right, each column
    // ordered top to bottom. Anything the exercise doesn't use drops out and
    // the rest keep their places.
    const LEFT = ["color", "pos"];
    const RIGHT = ["shape", "audio"];
    const active = exercise.modalities || [];
    // Nothing can match until N items have gone by, so until then a press
    // can only ever be wrong. The buttons stay visible but inert rather
    // than letting someone throw away a trial on a guess that was never
    // answerable.
    const armed = index >= n;
    const render = (m) => {
      const meta = MODALITY_META[m];
      const state = feedback[m];
      const cls =
        state === "wrong"
          ? "no-sheen bg-red-500"
          : state === "correct"
          ? BUTTON_PULSE
          : BUTTON_BASE;
      return (
        <button
          key={m}
          onClick={() => handlePress(m)}
          disabled={!armed}
          className={`w-full flex-1 transition-colors duration-150 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 md:gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
        >
          <span className="text-[0.65rem] md:text-sm font-medium uppercase tracking-wide opacity-70">
            {meta.label}
          </span>
          <span className="text-xl md:text-4xl font-semibold leading-none">
            {MODALITY_KEY_LABEL[m]}
          </span>
        </button>
      );
    };
    const spaced = (list) =>
      list.map((el, i) => (
        <Fragment key={el.key}>
          {i > 0 && <div className="hidden md:block h-6 lg:h-10 shrink-0" />}
          {el}
        </Fragment>
      ));
    return {
      left: spaced(LEFT.filter((m) => active.includes(m)).map(render)),
      right: spaced(RIGHT.filter((m) => active.includes(m)).map(render)),
    };
  }, [exercise.modalities, feedback, handlePress, index, n]);

  const isMotion3dApp = mainView === "app" && exercise.key === "motion3d";

  // Drives --ex, which every accent button reads from. Only set while an
  // exercise is actually on screen; the Overview step and every screen
  // outside training stay on the app's cyan so the colour means "you are
  // in this exercise" rather than being decoration.
  const themeColor =
    mainView === "app" && exercise.key !== "overview"
      ? EXERCISE_COLORS[exercise.key] || "#4CB9D8"
      : "#4CB9D8";

  return (
    <div
      ref={scrollRootRef}
      style={{ "--ex": themeColor }}
      className={`relative min-h-screen w-full bg-slate-950 text-slate-100 flex overflow-y-auto overflow-x-hidden ${
        isMotion3dApp
          ? "items-stretch justify-center p-2"
          : screen === "running"
          // The running screen is the one view that has to fit a square grid
          // plus its answer buttons inside the viewport, so it gets much
          // tighter vertical padding than the scrollable screens.
          ? "items-start justify-center px-2 md:px-4 pt-2 pb-2"
          : "items-center justify-center p-5 sm:p-8 lg:p-12"
      }`}
    >
      {/* The decorative glows sit at -top-40 / -bottom-40, i.e. 10rem OUTSIDE
          this container. An absolutely positioned descendant that overflows
          the bottom of a scroll container still contributes to its scrollable
          height, which is where the dead space under every page came from.
          Clipping them in their own inset-0 overflow-hidden layer keeps the
          look and removes the phantom 160px. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-violet-600/15 blur-[120px]" />
      </div>
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
        /* Hover and press feedback now lives entirely in index.css as a
           top-lit inset shadow. Keeping a second rule here meant every
           button was lightened twice, which is why the tinted ones (the
           Achievements pill especially) blew out on hover. */
        /* Session complete. Built as one sequence rather than three
           overlapping effects: a wash of light, the ring drawing itself
           closed, the mark landing inside it, then the words. */
        @keyframes sessionDoneWash {
          0% { opacity: 0; transform: scale(0.6); }
          16% { opacity: 1; }
          70% { opacity: 0.5; }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes sessionDoneRing {
          0% { transform: scale(0.4); opacity: 0; }
          45% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        /* The stroke draws round the circle instead of the whole ring
           fading up, which is what makes it read as being completed. */
        @keyframes sessionDoneTrace {
          0% { stroke-dashoffset: 302; opacity: 0; }
          8% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes sessionDoneMark {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        /* Percentages retimed for the longer hold: both settle early and
           then sit still for most of the screen, so there is time to read
           the line rather than watch it arrive and leave. */
        @keyframes sessionDoneText {
          0%, 7% { transform: translateY(14px); opacity: 0; filter: blur(8px); }
          22%, 92% { transform: translateY(0); opacity: 1; filter: blur(0); }
          100% { opacity: 0; filter: blur(0); }
        }
        @keyframes sessionDoneSub {
          0%, 16% { transform: translateY(10px); opacity: 0; }
          32%, 92% { transform: translateY(0); opacity: 1; }
          100% { opacity: 0; }
        }
        /* Sparks thrown outward as the mark lands. */
        @keyframes sessionDoneSpark {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--sx), var(--sy)) scale(1); opacity: 0; }
        }
        /* Tailwind's tracking-tight is -0.025em, which reads as cramped at
           the display sizes the headings use. Halved. */
        .tracking-tight { letter-spacing: -0.011em !important; }

        /* Also in index.css. Repeated here because the pointer cursor kept
           not appearing in the deployed build, and a style tag rendered by
           the component itself is the one place it cannot be missed. */
        button:not(:disabled),
        [role="button"]:not([aria-disabled="true"]),
        label[for],
        summary,
        select,
        a[href] { cursor: pointer !important; }
        button:disabled,
        [role="button"][aria-disabled="true"] { cursor: not-allowed !important; }

        /* The backdrop darkens first, on its own, so the content has
           something to arrive onto. */
        /* Rings pushing outward through the wait. */
        @keyframes prRing {
          0% { opacity: 0; transform: scale(0.2); }
          22% { opacity: 1; }
          72% { opacity: 0.45; }
          100% { opacity: 0; transform: scale(5.5); }
        }
        /* Full black, held a beat, then lifting to reveal the scene. */
        /* Recharts puts a tabindex on its wrapper, so clicking a chart
           left a blue focus rectangle around the plot area. */
        .recharts-wrapper:focus,
        .recharts-wrapper *:focus,
        .recharts-surface:focus { outline: none !important; }

        /* Sections grow into place instead of snapping open. */
        @keyframes sectionExpand {
          0% { opacity: 0; transform: translateY(-8px) scaleY(0.96); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }

        /* Full black, held a beat, then lifting to reveal the scene. */
        @keyframes prBlackout {
          0%, 22% { opacity: 1; }
          100% { opacity: 0; }
        }
        /* Motes travelling inward from the edge to the centre. */
        /* They fade out well before the centre. Ending at translate(0,0)
           stacked all eighteen on the same pixel, which read as one small
           dot sitting in the middle of the screen. */
        @keyframes prMote {
          0% { opacity: 0; transform: translate(var(--mx), var(--my)) scale(0.6); }
          20% { opacity: 1; }
          72% { opacity: 0; }
          100% { opacity: 0; transform: translate(calc(var(--mx) * 0.18), calc(var(--my) * 0.18)) scale(0.2); }
        }
        @keyframes prSparkle {
          0%, 100% { opacity: 0; transform: scale(0.3); }
          45% { opacity: 1; transform: scale(1); }
        }
        /* Vapour drifting upward and thinning as it goes. */
        @keyframes prVapour {
          0% { opacity: 0; transform: translateX(-50%) translateY(22vh) scale(0.6); }
          25% { opacity: 1; }
          70% { opacity: 0.75; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-28vh) scale(1.5); }
        }
        /* The spectrum arrives with the content, not before it. */
        @keyframes prVisualiser {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        /* A ring closing in on the centre, against the outward pulses. */
        @keyframes prRingIn {
          0% { opacity: 0; transform: scale(1.5); }
          25% { opacity: 0.6; }
          75% { opacity: 0.3; }
          100% { opacity: 0; transform: scale(0.18); }
        }
        /* A glow gathering where the gem will appear. */
        @keyframes prGather {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
        /* The whole pre-roll clears as the content takes over. */
        @keyframes prPrerollFade {
          0%, 60% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes prBackdrop {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        /* Then the content rises and resolves, over roughly the length of
           the music's fade-in. Blur going to zero is what makes it read as
           coming into focus rather than simply appearing. */
        @keyframes prReveal {
          0% { opacity: 0; transform: translateY(26px) scale(0.94); filter: blur(14px); }
          35% { opacity: 0.65; filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
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
        @keyframes switchIn {
          0% { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes switchBar {
          0% { width: 0%; }
          100% { width: 100%; }
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
            ? undefined
            : {
                // The running screen carries a column of answer buttons on
                // each side of the grid, so it needs more room than the
                // reading-width screens.
                maxWidth:
                  mainView === "app" && screen === "running" ? "100%" : "42rem",
              }
        }
      >
        {mainView === "regime" && (
          <div className="space-y-14">
            <div>
              {/* Same top-left Back as Account, Stats and the rest, instead
                  of a full-width button at the foot of the page. */}
              {regimeKey && (
                <button
                  onClick={() => setMainView("account")}
                  className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
                >
                  &lsaquo; Back
                </button>
              )}
              <div className="text-slate-100 text-lg font-semibold">
                VERSION {BUILD_VERSION} · {BUILD_TIME}
              </div>
              {/* Standing reminder, kept in the app rather than a note
                  elsewhere so it is unavoidable. Remove the block when the
                  work is done. */}
              <div
                className="mt-3 mb-5 space-y-2 text-sm leading-relaxed"
                style={{ color: "#E8158F" }}
              >
                <div className="font-semibold uppercase tracking-wide text-xs">
                  To fix
                </div>
                <div>
                  Fix the problem with how they view all of their stats.
                </div>
                <div>
                  One of the pages has its text off-centre, unlike the others.
                </div>
                <div>
                  Make the 3D MOT balls look better.
                </div>
                <div>
                  And to make this an experience, a ritual of wisdom that is an
                  experience not just training.
                </div>
                <div>
                  The goal isn't to just be a brain training app, it also is to
                  have psychological solutions that make it feel better and
                  easier, and to essentially nee like a pseudo motivation
                  mindset coach on top of the training exercises.
                </div>
              </div>
              <ul className="mt-1.5 mb-5 space-y-0.5">
                {BUILD_NOTES.map((note) => (
                  <li key={note} className="text-slate-500 text-xs flex gap-2">
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{note}</span>
                  </li>
                ))}
              </ul>
              <h1 className="text-5xl font-semibold tracking-tight">
                Choose your regime
              </h1>
              <p className="text-slate-400 text-base mt-3">
                You'll ease into it gradually, starting with a few minutes each session.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {REGIMES.map((r) => {
                const rc = REGIME_COLORS[r.key] || "#4CB9D8";
                return (
                  <button
                    key={r.key}
                    onClick={() => chooseRegime(r.key)}
                    /* hoverBorderStrong swapped the accent border for grey on
                       hover, which read as the card going duller and darker.
                       The accent border now stays put and the fill lightens
                       instead, from the sheen in index.css. */
                    /* Same filled treatment as an exercise's Start button,
                       carrying that exercise's colour, so the choice looks
                       like the thing it starts. */
                    style={{ "--ex": rc }}
                    className="w-full text-left deep-fill rounded-xl px-7 py-6 shadow-lg shadow-black/30"
                  >
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-semibold">{r.title}</div>
                        {r.key === "medium" && (
                          <span className="italic text-sm font-semibold">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-medium">{r.subtitle}</div>
                    </div>
                    <div className="text-base font-medium mt-1">{r.summary}</div>
                  </button>
                );
              })}

              {/* Locked regime — unlocks with the "1-Month Streak" achievement.
                  Purely a teaser for now: disabled, no click handler, just a
                  hover tooltip explaining what unlocks it. */}
              <div className="relative group">
                <button
                  disabled
                  className="w-full text-left bg-slate-900/60 border-2 border-slate-800 rounded-xl px-7 py-6 cursor-not-allowed"
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
                  <div className="text-slate-600 text-base mt-1">
                    Build your own regime.
                  </div>
                </button>
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium rounded-lg px-4 py-2 shadow-lg whitespace-nowrap z-10">
                  Achievement required: 1 month streak
                </div>
              </div>

              {/* Placeholder for the CCT regime, not built yet. Same locked
                  treatment as Custom so it reads as coming soon rather than
                  broken. */}
              <div className="relative group">
                <button
                  disabled
                  className="w-full text-left bg-slate-900/60 border-2 border-slate-800 rounded-xl px-7 py-6 cursor-not-allowed"
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                      <div className="text-2xl font-semibold text-slate-500 flex items-center gap-2">
                        🔒 Anti-brainrot
                      </div>
                    </div>
                    <div className="text-lg font-medium text-slate-600">—</div>
                  </div>
                  <div className="text-slate-600 text-base mt-1">CCT</div>
                </button>
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium rounded-lg px-4 py-2 shadow-lg whitespace-nowrap z-10">
                  Coming soon
                </div>
              </div>
            </div>


          </div>
        )}

        {mainView === "achievements" && (
          <div className="space-y-14">
            <div>
              <button
                onClick={() => setMainView("home")}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
              >
                ‹ Back
              </button>
              <h1 className="text-4xl font-semibold tracking-tight">Achievements</h1>
              <p className="text-slate-400 text-base mt-3">
                {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, achievementState)).length} of{" "}
                {ACHIEVEMENTS_CATALOG.length} unlocked
              </p>
            </div>

            {achievementExerciseSections().map((topSection) => {
              const group = topSection.key;
              const groupAccent = ACCENT_STYLES.indigo;
              const groupId = `${group}:__group`;
              const groupOpen = openAchievementSections.has(groupId);
              const groupItems = topSection.items;
              const groupUnlocked = groupItems.filter((a) =>
                isAchievementUnlocked(a, achievementState)
              ).length;
              return (
                <div key={group} className="space-y-5">
                  <button
                    onClick={() => toggleAchievementSection(groupId)}
                    aria-expanded={groupOpen}
                    className="w-full flex items-center gap-2.5 text-left bg-slate-900 border border-slate-700/60 hover:border-slate-500 transition-colors rounded-lg px-5 py-4"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: EXERCISE_COLORS[group] || "#4CB9D8" }}
                    />
                    <h2 className="flex-1 text-2xl font-semibold tracking-tight text-slate-100">
                      {topSection.label}
                    </h2>
                    <span className="text-sm text-slate-400 tabular-nums">
                      {groupUnlocked}/{groupItems.length}
                    </span>
                    <span
                      className="text-slate-400 text-sm transition-transform"
                      style={{ transform: groupOpen ? "rotate(90deg)" : "none" }}
                      aria-hidden="true"
                    >
                      ▶
                    </span>
                  </button>
                  {groupOpen && (
                  <div
                    className="space-y-5"
                    style={{ animation: "sectionExpand 0.28s ease-out both" }}
                  >
                  {/* Within a group, anything tagged with an exercise is
                      split out under that exercise's own header, in
                      EXERCISE_LIBRARY order, so the Performance list reads as
                      "RRT / Dual N-Back / …" instead of one long run. Untagged
                      achievements stay in a single unlabelled block first. */}
                  {achievementGroupSectionsFor(topSection.items).map((section) => {
                  const sectionId = `${group}:${section.key}`;
                  const isOpen = !section.label || openAchievementSections.has(sectionId);
                  const unlockedCount = section.items.filter((a) =>
                    isAchievementUnlocked(a, achievementState)
                  ).length;
                  return (
                  <div key={section.key} className="space-y-4">
                  {section.label && (
                    <button
                      onClick={() => toggleAchievementSection(sectionId)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center gap-2.5 text-left bg-slate-900 border border-slate-700/60 hover:border-slate-500 transition-colors rounded-lg px-5 py-4"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: EXERCISE_COLORS[group] || "#4CB9D8" }}
                      />
                      <h3 className="flex-1 text-2xl font-semibold tracking-tight text-slate-100">
                        {section.label}
                      </h3>
                      <span className="text-sm text-slate-400 tabular-nums">
                        {unlockedCount}/{section.items.length}
                      </span>
                      <span
                        className="text-slate-400 text-sm transition-transform"
                        style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                    </button>
                  )}
                  {isOpen && (
                  <div
                    className="grid grid-cols-1 gap-4 overflow-hidden"
                    style={{ animation: "sectionExpand 0.28s ease-out both" }}
                  >
                    {section.items.map((a) => {
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
                          className={`rounded-xl p-6 border transition-colors ${
                            isUnlocked
                              ? `${groupAccent.bg} ${groupAccent.border}`
                              : "bg-slate-900 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-6">
                            <div
                              className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-3xl ${
                                isUnlocked
                                  ? `bg-gradient-to-br ${groupAccent.grad} shadow-lg shadow-black/30`
                                  : "bg-slate-800 grayscale opacity-50"
                              }`}
                            >
                              {a.icon}
                            </div>
                            <div className="flex-1">
                              <AchievementTitle
                                achievement={a}
                                className="text-xl font-semibold"
                                baseColor={isUnlocked ? "#F7F8F8" : "#A6A9B1"}
                              />
                              <div className="text-base text-slate-400 mt-1.5 leading-relaxed">
                                {a.description}
                              </div>
                              {a.reward && (
                                <div className={`text-base mt-1.5 ${groupAccent.text}`}>
                                  Unlocks: {a.reward}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              {isUnlocked ? (
                                <span className={`text-base font-semibold ${groupAccent.text}`}>
                                  ✓ Achieved
                                </span>
                              ) : (
                                <span className="text-base text-slate-400 tabular-nums">
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
                        </div>
                      );
                    })}
                  </div>
                  )}
                  </div>
                  );
                  })}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {mainView === "wisdom" && (
          <div className="space-y-10" style={{ maxWidth: "42rem" }}>
            <div>
              <button
                onClick={() => setMainView("home")}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
              >
                &lsaquo; Back
              </button>
              <h1 className="text-4xl font-semibold tracking-tight">Wisdom</h1>
              <div className="text-slate-500 text-base mt-2">Book of Proverbs</div>
            </div>

            <p className="text-slate-100 text-lg leading-relaxed">
              A short quiz on the Book of Proverbs.
            </p>

            <div
              className="rounded-xl p-6 border"
              style={{
                borderColor: "#4CB9D833",
                background: "#4CB9D80D",
              }}
            >
              <p className="text-slate-300 text-base leading-relaxed">
                Note: you don't have to believe in the entire bible to get value
                from this quiz. There is practical wisdom anyone can use.
              </p>
            </div>

            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-500 text-base">
              Quiz coming soon.
            </div>
          </div>
        )}

        {(mainView === "privacy" || mainView === "terms") && (
          <LegalPage
            doc={mainView === "privacy" ? PRIVACY_POLICY : TERMS_OF_SERVICE}
            onBack={() => setMainView("account")}
          />
        )}

        {mainView === "hypnosis" && (
          <HypnosisScreen
            onDone={() => setMainView("home")}
            /* Reached at the end of a regime this is the last step of the
               session, so it gets a Skip under the player and no Back —
               there is nothing behind it to go back to. Opened from Home it
               is just a page, so it gets Back and no Skip. */
            afterSession={hypnosisAfterSession}
          />
        )}

        {mainView === "home" && (
          /* The Achievements and Leaderboard pills are fixed to the top
             corners. On a wide screen they sit clear of everything; on a
             phone the content has to start below them. */
          <div className="space-y-14 pt-12 sm:pt-0">
            <div className="flex items-start justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-5">
                {SHOW_PROFILE_IDENTITY_EDIT && (
                  <AvatarFrame tier={ownAvatarFrameTier}>
                    <Avatar avatarId={selectedAvatarId} imageUrl={customAvatarImage} size={44} />
                  </AvatarFrame>
                )}
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
                      ? "bg-amber-500/10 border border-amber-500/40 text-amber-300"
                      : "bg-slate-900 border border-slate-700/70 text-slate-500"
                  }`}
                >
                  <span className="text-lg">🔥</span>
                  <span>
                    {achievementState.streak}{" "}
                    {achievementState.streak === 1 ? "Day" : "Days"}
                  </span>
                </button>
                <button
                  onClick={() => bumpTestStreak(regimeKey)}
                  title="Test: +1 day streak"
                  className="flex items-center justify-center rounded-lg py-2 px-3 text-sm border border-dashed border-slate-600/70 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
                >
                  🧪 +1
                </button>
                {SHOW_TEST_TOOLS && (
                <button
                  onClick={resetTestStreak}
                  title="Test: reset streak to 0"
                  className="flex items-center justify-center rounded-lg py-2 px-3 text-sm border border-dashed border-slate-600/70 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
                >
                  🧪 ↺
                </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                const exColor = EXERCISE_COLORS[e.key] || "#4CB9D8";
                return (
                  /* A button rather than a div so it takes a press properly:
                     it lifts under the cursor, and a click runs a light
                     sweep across the face with a matching sound. */
                  <button
                    type="button"
                    key={e.key}
                    onClick={() => {
                      playShine();
                      setShineCard(e.key);
                    }}
                    onAnimationEnd={() => setShineCard(null)}
                    className={`ex-card rounded-xl p-6 text-white text-left${
                      shineCard === e.key ? " ex-card-shine" : ""
                    }`}
                    style={{
                      backgroundImage: exerciseDeepFill(exColor),
                      boxShadow:
                        "inset 0 1px rgba(255,255,255,0.16), inset 0 -1px rgba(0,0,0,0.25), 0 10px 15px -3px rgba(0,0,0,0.3)",
                      textShadow: "0 1px 2px rgba(0,0,0,0.35)",
                    }}
                  >
                    {/* Name and score stack on the left, gem sits opposite
                        it at the right edge and larger: it is the thing the
                        eye should land on first. */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xl font-semibold">{e.title}</div>
                        <div className="text-lg font-medium mt-2">
                          {isAccuracy
                            ? `${e.abbrev}${bestLevel}B`
                            : formatScoreValue(e, stat ? stat.bestAccuracy : level)}
                        </div>
                      </div>
                      {/* The gem's own drop-shadow is tuned for the
                          near-black page and all but vanishes on a coloured
                          card. A second shadow on the wrapper follows the
                          gem's actual silhouette, rather than sitting a
                          dark disc behind it. */}
                      <span
                        className="inline-flex shrink-0"
                        style={{
                          filter: `drop-shadow(0 5px 7px ${exerciseShadowColor(
                            exColor,
                            0.85
                          )}) drop-shadow(0 1px 3px ${exerciseShadowColor(exColor, 0.7)})`,
                        }}
                      >
                        <LevelGem level={bestLevel} size={64} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-900 border border-slate-700/70 rounded-xl p-7">
              <div className="text-xl font-semibold text-slate-100">
                Next session
              </div>
              {sessionInProgress || sessionParked ? (
                <div className="text-lg mt-2 font-medium" style={{ color: PR_YELLOW }}>
                  In progress
                  {sessionInProgress
                    ? ` · ${formatDuration(totalSessionTimeRemainingMs())} left`
                    : ""}
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
              {/* Wrapper, because a disabled button fires no hover events of
                  its own — the note has to live on something around it. */}
              <div className="relative group">
              {trainedToday && !sessionInProgress && !sessionParked && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-11 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg px-3 py-2 border text-sm whitespace-nowrap z-10"
                  style={{
                    borderColor: "#2A2E37",
                    background: "#0F1115",
                    color: "#F7F8F8",
                  }}
                >
                  Overtraining will hurt your results.
                </div>
              )}
              <button
                onClick={sessionParked ? continueSession : startFromHome}
                disabled={trainedToday && !sessionInProgress && !sessionParked}
                className="w-full deep-fill rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sessionInProgress
                  ? "Resume Training"
                  : sessionParked
                  ? "Continue Session"
                  : trainedToday
                  ? "Done for Today"
                  : "Start Training"}
              </button>
              </div>
              <button
                onClick={goToOverview}
                className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                Overview
              </button>
              <button
                onClick={() => {
                  setHypnosisAfterSession(false);
                  setMainView("hypnosis");
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                Motivation
              </button>
              <button
                onClick={() => setMainView("wisdom")}
                className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                Wisdom
              </button>
              {SHOW_TEST_TOOLS && (
              <button
                onClick={resetNextSessionForTesting}
                className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors rounded-lg py-3 text-sm"
              >
                🧪 Reset next session (test)
              </button>
              )}
              {/* One button per written line. Hover a number for the text;
                  click it to run the session-complete screen with that line. */}
              <div className="border border-dashed border-slate-700 rounded-lg p-4 space-y-3">
                <div className="text-sm text-slate-500">
                  🧪 Session complete screen (test) — {MOTIVATION_LINES.length} lines
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MOTIVATION_LINES.map((l) => (
                    <button
                      key={l.id}
                      title={`${l.text}${l.cond ? `  ·  ${l.cond}` : ""}`}
                      onClick={() => {
                        setNudgeIdOverride(l.id);
                        setSessionCompleteAnim(true);
                        playLevelUp();
                        setTimeout(() => setSessionCompleteAnim(false), 6200);
                      }}
                      className={`w-10 rounded-md py-1.5 text-xs font-medium tabular-nums border text-slate-300 hover:border-slate-400 ${
                        l.cond
                          ? "border-amber-700/70 bg-amber-950/30"
                          : "border-slate-700 bg-slate-800"
                      }`}
                    >
                      {l.id}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNudgeIdOverride(null);
                      setSessionCompleteAnim(true);
                      playLevelUp();
                      setTimeout(() => setSessionCompleteAnim(false), 6200);
                    }}
                    className="flex-1 rounded-lg py-2 text-xs font-medium border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    Real (uses your data)
                  </button>
                  <button
                    onClick={() => {
                      setSwitchQuote(nextTransitionQuote());
                      setSwitchNotice(true);
                      setMainView("app");
                      setTimeout(() => {
                        setSwitchNotice(false);
                        setMainView("home");
                      }, 3500);
                    }}
                    className="flex-1 rounded-lg py-2 text-xs font-medium border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    Between-round screen
                  </button>
                </div>
                <div className="text-xs text-slate-600">
                  Amber = has a condition. Grey = unconditional, also used between rounds.
                </div>
              </div>

              <div className="border border-dashed border-slate-700 rounded-lg p-4 space-y-3">
                <div className="text-sm text-slate-500">
                  🧪 Skip to exercise (test): bypasses regime/Start Training entirely
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(EXERCISE_LIBRARY).map((e) => (
                    <button
                      key={e.key}
                      onClick={() => jumpToExercise(e.key)}
                      className={`rounded-lg py-2.5 text-sm font-medium border transition-colors ${ACCENT_STYLES[e.accent].bg} ${ACCENT_STYLES[e.accent].border} text-slate-100 hover:opacity-80`}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-slate-100">
              <span>© {new Date().getFullYear()} Cortex</span>
              <span>
                Contact:{" "}
                <span className="underline underline-offset-2">hello@cortex.app</span>
              </span>
              <button
                onClick={() => setMainView("privacy")}
                className="hover:text-slate-400 transition-colors"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => setMainView("terms")}
                className="hover:text-slate-400 transition-colors"
              >
                Terms of Service
              </button>
            </div>
          </div>
        )}

        {SHOW_LEADERBOARD && mainView === "leaderboard" && (
          <div className="space-y-12">
            <div>
              <button
                onClick={() => setMainView("home")}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
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
                const isAccuracy = tabExercise?.scoreType === "accuracy";
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
                    } ${entryHasGlow ? "rank-glow" : ""}`}
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
                        <div className="text-base text-slate-100">
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
                {tutorialStepExercise.title} Tutorial
              </h1>
            </div>

            {["dual", "quad", "iqnb"].includes(tutorialStepExercise.key) ? (
              <NBackTutorial
                exercise={tutorialStepExercise}
                level={
                  tutorialStepExercise.key === "iqnb"
                    ? Math.floor(qnbPrimeLevel)
                    : n
                }
                onDone={() => {
                  if (tutorialDontShowAgain) {
                    setTutorialDismissed(tutorialStepExercise.key, true);
                  }
                  setMainView("app");
                  startTask(
                    tutorialStepExercise,
                    tutorialStepExercise.key === "iqnb"
                      ? Math.floor(qnbPrimeLevel)
                      : n
                  );
                }}
              />
            ) : tutorialStepExercise.key === "rrt" ? (
              <RrtTutorialAnimated
                onDone={() => {
                  if (tutorialDontShowAgain) {
                    setTutorialDismissed(tutorialStepExercise.key, true);
                  }
                  // Straight into the round. The setup screen only exists for
                  // people who did not just read the tutorial. RRT runs its
                  // own setup stage, so it gets a nudge rather than startTask.
                  setMainView("app");
                  setRrtAutoStart((v) => v + 1);
                }}
              />
            ) : tutorialStepExercise.key === "motion3d" ? (
              <Motion3DTutorial
                onDone={() => {
                  if (tutorialDontShowAgain) {
                    setTutorialDismissed(tutorialStepExercise.key, true);
                  }
                  setMainView("app");
                }}
              />
            ) : (
              /* Placeholder — real per-exercise walkthroughs go here as they
                 get built, the way RRT's has. */
              <div className="bg-slate-900 border border-dashed border-slate-700/70 rounded-lg p-8">
                <p className="text-slate-400 text-lg">
                  {TUTORIAL_CONTENT[tutorialStepExercise.key]}
                </p>
              </div>
            )}

            <label className="flex items-center gap-3 text-slate-400 hover:text-slate-200 transition-colors text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tutorialDontShowAgain}
                onChange={(e) => setTutorialDontShowAgain(e.target.checked)}
                className="sr-only peer"
              />
              <span
                className="w-4 h-4 shrink-0 rounded-[4px] border border-slate-600 flex items-center justify-center transition-colors peer-checked:border-transparent"
                style={{
                  background: tutorialDontShowAgain
                    ? EXERCISE_COLORS[tutorialStepExercise.key] || "#4CB9D8"
                    : "transparent",
                }}
              >
                {tutorialDontShowAgain && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0B0D10"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              Don't show this tutorial again
            </label>

            {/* RRT's walkthrough carries its own step buttons; the generic
                Next would be a second way out of the same screen. */}
            {!["rrt", "dual", "quad", "iqnb", "motion3d"].includes(tutorialStepExercise.key) && (
              <button
                onClick={() => {
                  if (tutorialDontShowAgain) {
                    setTutorialDismissed(tutorialStepExercise.key, true);
                  }
                  setMainView("app");
                }}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30"
              >
                Next
              </button>
            )}
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
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
              >
                ‹ Back
              </button>
              <h1 className="text-4xl font-semibold tracking-tight">
                Account
              </h1>
            </div>

            {SHOW_PROFILE_IDENTITY_EDIT && (
            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <AvatarFrame tier={ownAvatarFrameTier}>
                  <Avatar avatarId={selectedAvatarId} imageUrl={customAvatarImage} size={64} />
                </AvatarFrame>
                {SHOW_PROFILE_IDENTITY_EDIT && (
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
                )}
                {SHOW_PROFILE_IDENTITY_EDIT && customAvatarImage && (
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
                {SHOW_PROFILE_IDENTITY_EDIT ? (
                  isEditingName ? (
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
                  )
                ) : (
                  <div className="text-2xl font-semibold text-slate-100">
                    {displayName}
                  </div>
                )}
                {avatarUploadError && (
                  <div className="text-sm text-rose-400">{avatarUploadError}</div>
                )}
              </div>
            </div>
            )}

            {SHOW_BIO && (
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
            )}

            {SHOW_PROFILE_CUSTOMIZATION && (
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            )}

            {SHOW_BADGES && (
            <div>
              <button
                onClick={() => setBadgesExpanded((v) => !v)}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-500 transition-all duration-200 hover:shadow-lg rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
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
            )}

            {SHOW_TEST_TOOLS && (
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
            )}

            <button
              onClick={() => setMainView("regime")}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-500 transition-all duration-200 hover:shadow-lg rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
            >
              <span>Regime</span>
              <span className="text-slate-500 text-base font-normal">
                {REGIMES.find((r) => r.key === regimeKey)?.title || "Choose"} ›
              </span>
            </button>

            {/* Sits with Show tutorials because it behaves the same way: on
                unless the person turns it off, and set here rather than
                mid-exercise. */}
            <div className="w-full bg-slate-900 border border-slate-700/70 rounded-lg py-5 px-7 flex items-center justify-between">
              <div>
                <div className="text-xl font-medium">Binaural beats</div>
                <div className="text-slate-500 text-base mt-1">
                  40Hz Gamma tone, played quietly during exercises
                </div>
                {binauralAudioError && (
                  <div className="text-rose-400 text-base mt-1">⚠ {binauralAudioError}</div>
                )}
              </div>
              <Toggle
                on={binauralBeatsEnabled}
                onToggle={() => {
                  unlockBinauralAudio();
                  setBinauralBeatsEnabled(!binauralBeatsEnabled);
                }}
              />
            </div>

            <div className="w-full bg-slate-900 border border-slate-700/70 rounded-lg py-5 px-7 flex items-center justify-between">
              <div>
                <div className="text-xl font-medium">Show tutorials</div>
              </div>
              <Toggle
                on={!hideTutorials}
                onToggle={() => setHideTutorials(!hideTutorials)}
              />
            </div>

            {/* The in-exercise pointers are dismissed for good by their own
                tick box, which makes them impossible to see again without
                clearing storage by hand. */}
            <button
              onClick={() => {
                try {
                  localStorage.removeItem(RRT_TIMER_HINT_KEY);
                  localStorage.removeItem(RRT_HISTORY_HINT_KEY);
                  localStorage.removeItem(RRT_ANSWERED_KEY);
                  localStorage.removeItem(RRT_BACK_HINT_KEY);
                } catch {
                  /* nothing to clear without storage */
                }
                window.location.reload();
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-500 transition-all duration-200 rounded-lg py-5 text-xl font-medium text-left px-7"
            >
              Bring back the exercise hints
            </button>

            <button
              onClick={() => setMainView("membership")}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-500 transition-all duration-200 hover:shadow-lg rounded-lg py-5 text-xl font-medium text-left px-7 flex items-center justify-between"
            >
              <span>Membership</span>
              <span className="text-slate-500 text-base font-normal capitalize">
                {membershipPlan} ›
              </span>
            </button>

            <div>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem("cortex.billingState");
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith("cortex.membershipOk."))
                      .forEach((k) => localStorage.removeItem(k));
                  } catch {}
                  supabase.auth.signOut();
                }}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-colors rounded-lg px-4 py-2 text-sm font-medium text-slate-200"
              >
                Log out
              </button>
            </div>

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

            {/* Legal and contact footer. Both policy links open real pages
                inside the app rather than leaving it. */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-slate-100">
              <span>© {new Date().getFullYear()} Cortex</span>
              <span>
                Contact:{" "}
                <span className="underline underline-offset-2">hello@cortex.app</span>
              </span>
              <button
                onClick={() => setMainView("privacy")}
                className="hover:text-slate-400 transition-colors"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => setMainView("terms")}
                className="hover:text-slate-400 transition-colors"
              >
                Terms of Service
              </button>
            </div>
          </div>
        )}

        {mainView === "membership" && (
          <div className="space-y-14">
            {/* Same markup as the Account screen's back button so every
                back control in the app looks and behaves identically. */}
            <button
              onClick={() => setMainView("account")}
              className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
            >
              &lsaquo; Back
            </button>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                Membership
              </h1>
            </div>

            {isAchievementUnlocked(
              ACHIEVEMENTS_CATALOG.find((a) => a.id === "regimeStreak7"),
              achievementState
            ) && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-5 text-emerald-300 text-base flex items-center gap-3">
                <span className="text-2xl">🎁</span>
                <span>Free month applied for your 7-Day Regime Streak</span>
              </div>
            )}

            {billingLoading && !billingState && (
              /* A skeleton in the shape of the real cards, so the page is
                 drawn the instant it opens instead of showing a line of
                 text where the content will be. */
              <div className="space-y-14 animate-pulse">
                <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-7 space-y-4">
                  <div className="h-4 w-28 bg-slate-800 rounded" />
                  <div className="h-7 w-56 bg-slate-800 rounded" />
                  <div className="h-4 w-40 bg-slate-800 rounded" />
                </div>
                <div className="h-16 bg-slate-900 border border-slate-700/70 rounded-lg" />
                <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-7 space-y-4">
                  <div className="h-4 w-36 bg-slate-800 rounded" />
                  <div className="h-6 w-48 bg-slate-800 rounded" />
                  <div className="h-14 bg-slate-800 rounded-lg" />
                </div>
              </div>
            )}

            {billingError && !billingState && (
              <div className="bg-red-950/40 border border-red-900 rounded-lg p-5 text-red-400 text-base">
                {billingError}
              </div>
            )}

            {billingState && (
              <>
                <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-7 space-y-3">
                  <div className="text-slate-400 text-base uppercase tracking-wide">
                    Current plan
                  </div>
                  <div className="text-2xl font-semibold capitalize">
                    {billingState.scheduledPlan === "monthly" ? "annual" : billingState.plan}{" "}
                    {/* While a downgrade is only scheduled, billingState.amount is
                        already the FUTURE monthly price. Showing it next to
                        "annual" would read as $40 for a year, so it is omitted
                        and the amber line below explains the timing instead. */}
                    {billingState.scheduledPlan !== "monthly" && (
                      <span className="text-slate-400 text-lg font-normal">
                        ${(billingState.amount / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* These used to be one if/else chain, so a scheduled plan
                      change hid the pause line entirely. They can all be true
                      at once, so each renders on its own and only "Renews"
                      is suppressed when something more specific applies. */}
                  {billingState.pausedUntil && (
                    <div className="text-amber-400 text-base">
                      Paused until{" "}
                      {new Date(billingState.pausedUntil * 1000).toLocaleDateString()}
                    </div>
                  )}
                  {billingState.cancelAtPeriodEnd && (
                    <div className="text-red-400 text-base">
                      Cancels on{" "}
                      {new Date(billingState.currentPeriodEnd * 1000).toLocaleDateString()}
                    </div>
                  )}
                  {!billingState.cancelAtPeriodEnd &&
                    billingState.scheduledPlan &&
                    billingState.scheduledPlanAt && (
                    <div className="text-amber-400 text-base">
                      Annual until{" "}
                      {new Date(billingState.scheduledPlanAt * 1000).toLocaleDateString()}, then
                      switches to monthly
                      </div>
                    )}
                  {!billingState.pausedUntil &&
                    !billingState.cancelAtPeriodEnd &&
                    !billingState.scheduledPlan && (
                      <div className="text-slate-400 text-base">
                        Renews{" "}
                        {new Date(billingState.currentPeriodEnd * 1000).toLocaleDateString()}
                      </div>
                    )}
                </div>

                {billingState.openInvoiceId && (
                  <div className="bg-amber-950/40 border border-amber-800 rounded-lg p-5 space-y-3">
                    <div className="text-amber-300 text-base">
                      A recent payment didn't go through. Update your card or retry to keep
                      your membership active.
                    </div>
                    <button
                      onClick={handleRetryInvoice}
                      disabled={actionLoading}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition-colors rounded-lg py-3 px-6 text-base font-medium"
                    >
                      Retry payment
                    </button>
                  </div>
                )}

                {actionError && <div className="text-red-400 text-sm">{actionError}</div>}

                {!billingState.cancelAtPeriodEnd &&
                  !billingState.pausedUntil &&
                  !previewTargetPlan && (
                  <div className="flex flex-col gap-4">
                    {billingState.plan !== "annual" && (
                      <button
                        onClick={() => handlePreviewSwitch("annual")}
                        disabled={previewLoading || actionLoading}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium"
                      >
                        Switch to annual
                      </button>
                    )}
                    {billingState.plan !== "monthly" && (
                      <button
                        onClick={() => handlePreviewSwitch("monthly")}
                        disabled={previewLoading || actionLoading}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium"
                      >
                        Switch to monthly
                      </button>
                    )}
                  </div>
                )}

                {previewTargetPlan && !previewData && (
                  <div className="bg-slate-900 border border-indigo-500/40 rounded-lg p-7 space-y-4">
                    <div className="text-lg font-semibold">
                      Switch to {previewTargetPlan}?
                    </div>
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                      <div className="h-4 bg-slate-800 rounded w-2/3" />
                      <div className="h-4 bg-slate-800 rounded w-1/3 mt-4" />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelSwitch}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-3 font-medium text-base"
                      >
                        Cancel
                      </button>
                      <button
                        disabled
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-50 rounded-lg py-3 font-medium text-base"
                      >
                        Calculating…
                      </button>
                    </div>
                  </div>
                )}

                {previewData && previewTargetPlan && (
                  <div className="bg-slate-900 border border-indigo-500/40 rounded-lg p-7 space-y-4">
                    <div className="text-lg font-semibold">
                      Switch to {previewTargetPlan}?
                    </div>
                    {previewData.revert ? (
                      <div className="text-sm text-slate-400 space-y-2">
                        <p>This cancels your scheduled switch to monthly.</p>
                      </div>
                    ) : previewData.deferred ? (
                      <div className="text-sm text-slate-400 space-y-2">
                        <p>
                          Nothing is charged today. You keep annual access until{" "}
                          <span className="text-slate-200">
                            {new Date(previewData.effectiveDate * 1000).toLocaleDateString()}
                          </span>
                          , then billing continues monthly at $40.00.
                        </p>
                      </div>
                    ) : null}
                    <div
                      className={previewData.deferred ? "hidden" : "space-y-1.5 text-sm text-slate-400"}
                    >
                      {previewData.lines.map((line, i) => (
                        <div key={i} className="flex justify-between gap-4">
                          <span>{line.desc}</span>
                          <span className="text-slate-300">
                            ${(line.amount / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!previewData.deferred && previewData.creditApplied < 0 && (
                      <div className="flex justify-between text-sm text-emerald-400 border-t border-slate-800 pt-3">
                        <span>Account credit applied</span>
                        <span>
                          -${(Math.abs(previewData.creditApplied) / 100).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div
                      className={
                        previewData.deferred
                          ? "hidden"
                          : "flex justify-between text-base font-semibold border-t border-slate-800 pt-3"
                      }
                    >
                      <span>Due now</span>
                      <span>
                        ${(previewData.dueNow / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelSwitch}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-3 font-medium text-base"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmSwitch}
                        disabled={actionLoading}
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 disabled:opacity-50 transition-opacity rounded-lg py-3 font-medium text-base"
                      >
                        {actionLoading ? "Confirming…" : "Confirm switch"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-7 space-y-4">
                  <div className="text-slate-400 text-base uppercase tracking-wide">
                    Payment method
                  </div>
                  {billingState.card && !setupClientSecret && (
                    <div className="text-lg capitalize">
                      {billingState.card.brand} •••• {billingState.card.last4}{" "}
                      <span className="text-slate-500 text-base">
                        exp {billingState.card.expMonth}/{billingState.card.expYear}
                      </span>
                    </div>
                  )}
                  {cardUpdateSaved && (
                    <p className="text-emerald-400 text-sm">Payment method updated.</p>
                  )}
                  {!setupClientSecret && (
                    <button
                      onClick={handleStartCardUpdate}
                      disabled={setupLoading}
                      className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700/70 transition-colors rounded-lg py-4 text-base font-medium"
                    >
                      {setupLoading ? "Loading…" : "Update payment method"}
                    </button>
                  )}
                  {setupError && <p className="text-sm text-red-400">{setupError}</p>}
                  {setupClientSecret && typeof BillingCardForm === "function" && (
                    <BillingCardForm
                      clientSecret={setupClientSecret}
                      onDone={(setupIntentId) => {
                        setSetupClientSecret(null);
                        setCardUpdateSaved(true);
                        // confirm-card promotes the new card to the
                        // subscription's default and returns fresh state,
                        // so the card line re-renders with the new digits.
                        callBillingApi("confirm-card", { setupIntentId })
                          .then(applyBillingState)
                          .catch((err) => setSetupError(err.message));
                      }}
                      onError={(msg) => setSetupError(msg)}
                    />
                  )}
                  {setupClientSecret && typeof BillingCardForm !== "function" && (
                    <div className="text-sm text-slate-500 border border-dashed border-slate-700 rounded-lg p-4">
                      Card form placeholder. Renders as the real embedded Stripe form once
                      deployed (see BillingCardForm.jsx).
                    </div>
                  )}
                </div>

                {!billingState.cancelAtPeriodEnd &&
                  (billingState.pausedUntil ? (
                    <button
                      onClick={handleResume}
                      disabled={actionLoading}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium"
                    >
                      Resume membership
                    </button>
                  ) : billingState.plan === "annual" ? null : (
                    <div className="space-y-3">
                      <div className="text-slate-400 text-base">Pause billing for</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[1, 2, 3].map((m) => (
                          <button
                            key={m}
                            onClick={() => handlePause(m)}
                            disabled={actionLoading}
                            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-700/70 transition-colors rounded-lg py-5 text-xl font-medium"
                          >
                            {m} month{m > 1 ? "s" : ""}
                          </button>
                        ))}
                      </div>
                      <p className="text-slate-500 text-sm">
                        You keep your streak and history while you are away. Your membership
                        will start again after the pause.
                      </p>
                    </div>
                  ))}

                {billingState.cancelAtPeriodEnd ? (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading}
                    className="w-full bg-emerald-950/40 hover:bg-emerald-950/60 disabled:opacity-50 border border-emerald-800 text-emerald-400 transition-colors rounded-lg py-5 text-xl font-medium"
                  >
                    Reactivate membership
                  </button>
                ) : !showCancelForm ? (
                  <div className="space-y-3">
                  <button
                    onClick={() => setShowCancelForm(true)}
                    disabled={actionLoading}
                    className="w-full bg-red-950/40 hover:bg-red-950/60 disabled:opacity-50 border border-red-900 text-red-400 transition-colors rounded-lg py-5 text-xl font-medium"
                  >
                    Cancel membership
                  </button>
                  <p className="text-slate-500 text-sm">
                    You keep access until{" "}
                    {new Date(billingState.currentPeriodEnd * 1000).toLocaleDateString()}. Your
                    streak and scores are saved, so you can pick up where you left off if you
                    come back.
                  </p>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-red-900/60 rounded-lg p-7 space-y-4">
                    <div className="text-lg font-semibold">Sorry to see you go</div>
                    <select
                      value={cancelFeedback}
                      onChange={(e) => setCancelFeedback(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-base text-slate-100"
                    >
                      <option value="">Why are you canceling? (optional)</option>
                      <option value="too_expensive">Too expensive</option>
                      <option value="unused">Not using it enough</option>
                      <option value="missing_features">Missing features</option>
                      <option value="too_complex">Too complex</option>
                      <option value="switched_service">Switched to another service</option>
                      <option value="customer_service">Customer service</option>
                      <option value="other">Other</option>
                    </select>
                    <textarea
                      value={cancelComment}
                      onChange={(e) => setCancelComment(e.target.value)}
                      placeholder="Anything else? (optional)"
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-base text-slate-100 resize-none"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCancelForm(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-3 font-medium text-base"
                      >
                        Never mind
                      </button>
                      <button
                        onClick={handleCancelSubmit}
                        disabled={actionLoading}
                        className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 transition-colors rounded-lg py-3 font-medium text-base"
                      >
                        {actionLoading ? "Canceling…" : "Confirm cancel"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

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
                  onClick={() => {
                    logPartialSession(exercise.key);
                    setMainView("home");
                  }}
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
          /* The hand-off between exercises. A fixed overlay rather than page
             content, because the page container's alignment differs between
             the running screen and the others, which is why this landed in
             the middle after one exercise and near the top after another. */
          <div className="fixed inset-0 z-40 flex flex-col items-center justify-center text-center gap-8 px-6 bg-slate-950">
            <div
              className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500"
              style={{ animation: "switchIn 0.5s ease-out both" }}
            >
              Next exercise
            </div>
            <h1
              className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-2xl"
              style={{ animation: "switchIn 0.9s 0.18s cubic-bezier(0.16,0.8,0.24,1) both", textWrap: "balance" }}
            >
              {switchQuote}
            </h1>
            {/* A line that fills over the wait, so the length of the pause is
                visible rather than felt as a stall. */}
            <div className="w-40 h-0.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: "var(--ex)",
                  animation: "switchBar 4.2s linear both",
                }}
              />
            </div>
          </div>
        )}

        {!switchNotice && levelChangeNotice && (
          <div className="text-base rounded-lg px-5 py-2 mb-6 border text-amber-400 bg-amber-950/40 border-amber-800">
            Below {PASS_THRESHOLD}% three times in a row, so N level dropped to {n}.
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
                  ? `${e.abbrev} ${formatScoreValue(e, stat.bestAccuracy)}`
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
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: EXERCISE_COLORS[e.key] || "#4CB9D8" }}
                    />
                    {e.title}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Stat
                      label={bestLabel}
                      value={bestValue}
                      color={stat && isAccuracy ? accuracyColor(stat.bestAccuracy) : undefined}
                    />
                    <Stat
                      label={avgLabel}
                      value={avgValue}
                      color={stat && isAccuracy ? accuracyColor(avgVal) : undefined}
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
              {/* Opened from Home this is just a page they were browsing, so
                  it goes back Home. Reached at the end of a regime it is the
                  real end of a session, which is the only time the Motivation
                  track should be offered. */}
              <button
                onClick={() => {
                  if (overviewSource === "home") {
                    setMainView("home");
                    return;
                  }
                  setNudgeIdOverride(null);
                  setSessionCompleteAnim(true);
                  playLevelUp();
                  setTimeout(() => {
                    setSessionCompleteAnim(false);
                    setHypnosisAfterSession(true);
                    setMainView("hypnosis");
                  }, 6200);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
              >
                {overviewSource === "home" ? "Home" : "Done"}
              </button>
            </div>
          </div>
        )}

        {!switchNotice && exercise.key === "overview" && overviewView === "graph" && (
          <div className="space-y-14">
            <div>
              <button
                onClick={() => setOverviewView("summary")}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-6"
              >
                ‹ Back
              </button>
            </div>
            <div className="flex items-start justify-between gap-4 -mt-12">
              <h1 className="text-4xl font-semibold tracking-tight">
                Stats
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
              ? statsExercises.map((e) => {
              const history = exerciseHistory[e.key] || [];
              const exColor = EXERCISE_COLORS[e.key] || "#4CB9D8";
              const avgColor = `color-mix(in srgb, ${exColor} 45%, #8A8F98)`;
              const windowed = history.filter((h) => sessionLevel(e, h) != null);
              const spanDays = windowed.length
                ? (windowed[windowed.length - 1].ts - windowed[0].ts) / 86400000
                : 0;
              // Chooses itself from how much history there is: every session
              // for the first 90 days, then one point a week, then one a
              // month past a year. Nothing for anyone to set.
              const grain =
                spanDays > 400 ? "month" : spanDays > 90 ? "week" : "session";
              const chartData = withRunningAverage(
                aggregateSessions(
                  windowed.map((h, i) => ({
                    session: i + 1,
                    label: String(i + 1),
                    ts: h.ts,
                    level: sessionLevel(e, h),
                  })),
                  grain
                )
              );
              return (
                <div key={e.key} className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: EXERCISE_COLORS[e.key] || "#4CB9D8" }}
                    />
                    {e.title}
                  </h2>
                  {chartData.length > 0 ? (
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-2 sm:p-6 h-[22rem] sm:h-[30rem]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{ top: 8, right: 8, bottom: 20, left: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id={`exFill-${e.key}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor={EXERCISE_COLORS[e.key] || "#4CB9D8"}
                                stopOpacity={0.45}
                              />
                              <stop
                                offset="100%"
                                stopColor={EXERCISE_COLORS[e.key] || "#4CB9D8"}
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#23252A" />
                          <XAxis
                            dataKey="label"
                            stroke="#6E7178"
                            tick={{ fill: "#6E7178", fontSize: 12 }}
                            minTickGap={24}
                            label={{
                              value:
                                grain === "month"
                                  ? "Month"
                                  : grain === "week"
                                  ? "Week"
                                  : "Session",
                              position: "insideBottom",
                              offset: -8,
                              fill: "#6E7178",
                              fontSize: 12,
                            }}
                          />
                          <YAxis
                            domain={["auto", "auto"]}
                            stroke="#6E7178"
                            width={56}
                            tick={{ fill: "#6E7178", fontSize: 12 }}
                            tickFormatter={(v) => formatLevelTick(e, v)}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#101112",
                              border: "1px solid #23252A",
                              borderRadius: 8,
                              color: "#F7F8F8",
                            }}
                            labelFormatter={(label, payload) => {
                              const ts = payload && payload[0] && payload[0].payload.ts;
                              // Built from parts rather than toLocaleDateString
                              // so no locale slips a comma back in.
                              const d = ts ? new Date(ts) : null;
                              const when = d
                                ? [
                                    d.toLocaleDateString(undefined, { weekday: "short" }),
                                    d.getDate(),
                                    d.toLocaleDateString(undefined, { month: "short" }),
                                    d.getFullYear(),
                                  ]
                                    .join(" ")
                                    .replace(/,/g, "")
                                : null;
                              const count =
                                payload && payload[0] && payload[0].payload.sessions;
                              if (grain !== "session") {
                                return count
                                  ? `${when} · ${count} session${count === 1 ? "" : "s"}`
                                  : when;
                              }
                              return when
                                ? `${when} · Session ${label}`
                                : `Session ${label}`;
                            }}
                            formatter={(value, name) => [
                              formatLevelValue(e, value),
                              name === "avg" ? "Avg score" : "Best score",
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="level"
                            name="level"
                            stroke={exColor}
                            strokeWidth={2.5}
                            fill={`url(#exFill-${e.key})`}
                            dot={(props) => renderPRDot(props, exColor)}
                            activeDot={{ r: 5 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="avg"
                            name="avg"
                            stroke={avgColor}
                            strokeWidth={2}
                            strokeDasharray="5 4"
                            fill="none"
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                  {chartData.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
                      <span className="flex items-center gap-2">
                        <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
                          <line x1="0" y1="5" x2="22" y2="5" stroke={exColor} strokeWidth="2.5" />
                        </svg>
                        Best score
                      </span>
                      <span className="flex items-center gap-2">
                        <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
                          <line
                            x1="0"
                            y1="5"
                            x2="22"
                            y2="5"
                            stroke={avgColor}
                            strokeWidth="2"
                            strokeDasharray="5 4"
                          />
                        </svg>
                        Avg score
                      </span>
                      <span className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                          <circle cx="7" cy="7" r="6" fill="none" stroke={PR_YELLOW} strokeWidth="1.5" />
                          <circle cx="7" cy="7" r="2.5" fill={PR_YELLOW} />
                        </svg>
                        New personal record
                      </span>
                    </div>
                  ) : null}
                  {chartData.length === 0 && (
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-8 text-center text-slate-500 text-base">
                      No completed sessions yet.
                    </div>
                  )}
                </div>
              );
            })
              : statsExercises.map((e) => {
              const exColor = EXERCISE_COLORS[e.key] || "#4CB9D8";
              // Averages and records only make sense oldest-first, so build
              // them that way and flip back to newest-first for display.
              const rows = markDayRecords(
                buildExerciseDailyRows(exerciseHistory[e.key], e)
                  .slice()
                  .reverse()
                  .map((r) => ({ ...r, level: sessionLevel(e, r) }))
              ).reverse();
              const pageCount = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
              const page = Math.min(historyPage[e.key] || 0, pageCount - 1);
              const pageRows = rows.slice(
                page * HISTORY_PAGE_SIZE,
                page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE
              );
              return (
                <div key={e.key} className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: EXERCISE_COLORS[e.key] || "#4CB9D8" }}
                    />
                    {e.title}
                  </h2>
                  {rows.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg p-8 text-center text-slate-500 text-base">
                      No completed sessions yet.
                    </div>
                  ) : (
                    <div className="relative">
                    <div className="bg-slate-900 border border-slate-700/70 rounded-lg overflow-x-auto">
                      <table className="w-full min-w-[34rem] text-xs sm:text-sm whitespace-nowrap">
                        <thead>
                          <tr
                            className="border-b border-slate-700/70 text-left text-slate-100"
                            style={{ height: SHEET_ROW_H }}
                          >
                            <th className="px-2.5 sm:px-4 py-2.5 font-medium">Day</th>
                            <th className="px-2.5 sm:px-4 py-2.5 font-medium">Date</th>
                            <th className="px-2.5 sm:px-4 py-2.5 font-medium">Time</th>
                            <th className="px-2.5 sm:px-4 py-2.5 font-medium">Best score</th>
                            <th className="px-2.5 sm:px-4 py-2.5 font-medium">Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((row) => {
                            const d = new Date(row.ts);
                            return (
                              <tr
                                key={row.dateKey}
                                className="border-b border-slate-800/70 last:border-0"
                                style={{
                                  height: SHEET_ROW_H,
                                  // Red covers both "did not train" and
                                  // "started but never finished a run" —
                                  // either way no score was set that day.
                                  backgroundColor:
                                    row.level == null
                                      ? "rgba(151,20,38,0.14)"
                                      : "rgba(30,152,43,0.12)",
                                }}
                              >
                                <td className="px-2.5 sm:px-4 py-2.5 text-slate-100">
                                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                                </td>
                                <td className="px-2.5 sm:px-4 py-2.5 text-slate-100">
                                  {d.toLocaleDateString()}
                                </td>
                                <td className="px-2.5 sm:px-4 py-2.5 text-slate-100">
                                  {row.durationMs ? formatDuration(row.durationMs) : "—"}
                                </td>
                                <td
                                  className="px-2.5 sm:px-4 py-2.5 font-medium"
                                  style={
                                    row.isPR
                                      ? {
                                          color: PR_YELLOW,
                                          backgroundColor: `${PR_YELLOW}26`,
                                          boxShadow: `inset 0 0 0 1px ${PR_YELLOW}66`,
                                        }
                                      : { color: "#F7F8F8" }
                                  }
                                >
                                  {formatScoreCell(e, row)}
                                  {row.isPR && (
                                    <span className="lg:hidden ml-2 text-xs font-semibold">
                                      New PR!
                                    </span>
                                  )}
                                </td>
                                <td
                                  className="px-2.5 sm:px-4 py-2.5 font-medium"
                                  style={
                                    row.isAvgPR
                                      ? {
                                          color: PR_YELLOW,
                                          backgroundColor: `${PR_YELLOW}26`,
                                          boxShadow: `inset 0 0 0 1px ${PR_YELLOW}66`,
                                        }
                                      : { color: "#F7F8F8" }
                                  }
                                >
                                  {formatLevelValue(e, row.dayAvg)}
                                  {row.isAvgPR && (
                                    <span className="lg:hidden ml-2 text-xs font-semibold">
                                      New PR!
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Gutter outside the table. Every row is a fixed height,
                        so a marker can be placed at exactly its row without
                        measuring the DOM. */}
                    <div
                      className="hidden lg:block absolute top-0 left-full ml-3 w-24 pointer-events-none"
                      style={{ height: SHEET_ROW_H * (pageRows.length + 1) }}
                    >
                      {pageRows.map((row, i) =>
                        row.isPR || row.isAvgPR ? (
                          <div
                            key={row.dateKey}
                            className="absolute left-0 right-0 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
                            style={{
                              top: SHEET_ROW_H * (i + 1),
                              height: SHEET_ROW_H,
                              color: PR_YELLOW,
                            }}
                          >
                            <span aria-hidden="true">←</span>
                            New PR!
                          </div>
                        ) : null
                      )}
                    </div>
                    </div>
                  )}
                  {pageCount > 1 && (
                    <div className="flex items-center justify-between gap-4">
                      <button
                        onClick={() =>
                          setHistoryPage((prev) => ({
                            ...prev,
                            [e.key]: Math.max(0, page - 1),
                          }))
                        }
                        disabled={page === 0}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg py-2 px-5 text-base font-medium"
                      >
                        Back
                      </button>
                      <span aria-hidden="true" />
                      <button
                        onClick={() =>
                          setHistoryPage((prev) => ({
                            ...prev,
                            [e.key]: Math.min(pageCount - 1, page + 1),
                          }))
                        }
                        disabled={page >= pageCount - 1}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg py-2 px-5 text-base font-medium"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={seedFakeHistory}
              className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-3 text-base"
            >
              🧪 Test: fill 90 days of fake history
            </button>

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
            branchingEnabled={true}
            autoStart={rrtAutoStart}
          />
        )}

        {!switchNotice && exercise.key === "motion3d" && (
          <Motion3DExercise
            exercise={exercise}
            onFinish={() => forceSwitchToNext(exerciseIndex)}
            onForceOverview={() => forceJumpToOverview(exerciseIndex)}
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
                <p className="text-slate-500 text-base mt-3">Incremental N-back</p>
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
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Title and trials-remaining on one line, so the header is a
                single band above the grid rather than two stacked rows. */}
            <div className="flex items-baseline justify-center gap-3">
              <div className="text-2xl font-semibold tracking-tight text-slate-100">
                {exercise.key === "iqnb"
                  ? `${exercise.abbrev} ${qnbPrimeLevel.toFixed(2)}`
                  : `${exercise.abbrev}${n}B`}
              </div>
              <div className="text-2xl font-semibold tracking-tight text-slate-100">
                {trialCount - index}
              </div>
            </div>

            {/* Answer buttons flank the grid rather than sitting under it.
                That buys the lattice the vertical space the button row used
                to take, so the stimulus is bigger on the same screen, and it
                puts the two hands' targets where the hands already are. */}
            {/* Side by side from md up, stacked below it: on a phone the two
                button columns cannot sit beside a square grid and leave the
                grid anything usable, so they drop underneath it instead,
                which also puts them under the thumbs. */}
            <div className="flex flex-col md:flex-row items-center md:items-stretch justify-between gap-2.5 w-full">
            <div className="order-2 md:order-1 flex md:flex-col justify-between gap-2.5 md:gap-0 h-14 md:h-auto w-full md:w-28 lg:w-36 shrink-0">
              {nbackSideButtons.left}
            </div>
            <div
              className="nback-box order-1 md:order-2"
              style={{
                aspectRatio: "1 / 1",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gridTemplateRows: "repeat(3, 1fr)",
                gap: 0,
                borderTop: `1px solid ${NBACK_GRID_LINE}`,
                borderLeft: `1px solid ${NBACK_GRID_LINE}`,
              }}
            >
              {POSITIONS.map((cellIdx) => {
                const isActive = activeCell === cellIdx;
                const shapeType = exercise.modalities.includes("shape")
                  ? sequence.shape?.[index]
                  : "square";
                const color = exercise.modalities.includes("color")
                  ? sequence.color?.[index]
                  : themeColor;
                const hasShapeOrColor =
                  exercise.modalities.includes("shape") ||
                  exercise.modalities.includes("color");
                return (
                  <div
                    key={cellIdx}
                    className="flex items-center justify-center overflow-hidden transition-colors"
                    style={{
                      borderRight: `1px solid ${NBACK_GRID_LINE}`,
                      borderBottom: `1px solid ${NBACK_GRID_LINE}`,
                      backgroundColor: isActive ? NBACK_CELL_ACTIVE : NBACK_CELL_BG,
                    }}
                  >
                    {isActive && hasShapeOrColor && (
                      <div className="nback-stimulus">
                        {exercise.key === "iqnb" ? (
                          <VoronoiShapeIcon
                            shape={shapeType}
                            color={color}
                            seed={`${index}-${shapeType}-${color}`}
                            size={220}
                          />
                        ) : (
                          <ShapeIcon shape={shapeType} color={color} size={220} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="order-3 flex md:flex-col justify-between gap-2.5 md:gap-0 h-14 md:h-auto w-full md:w-28 lg:w-36 shrink-0">
              {nbackSideButtons.right}
            </div>
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

        {!switchNotice && screen === "results" && exercise.key !== "overview" && (
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

            <button
              onClick={() => {
                logPartialSession(exercise.key);
                setMainView("home");
              }}
              className="self-start text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-2"
            >
              ‹ Home
            </button>

            <h1 className="text-4xl font-semibold tracking-tight">
              Round {Math.max(1, roundNumber - 1)}
            </h1>
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
              <div className="bg-slate-900 border border-slate-700/60 rounded-lg p-6">
                <div className="text-3xl font-semibold tracking-tight text-slate-100">
                  {exercise.abbrev} {qnbPrimeLevel.toFixed(2)}
                </div>
              </div>
            )}


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {exercise.modalities.map((m) => (
                <Stat
                  key={m}
                  label={MODALITY_META[m].label}
                  value={`${accuracyFor(m)}%`}
                  color={accuracyColor(accuracyFor(m))}
                />
              ))}
            </div>

            <button
              onClick={() => startTask(exercise, n)}
              className={`w-full bg-gradient-to-r ${ACCENT_STYLES[exercise.accent].grad} rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
            >
              Continue <span className="text-base font-normal opacity-70">(space)</span>
            </button>
          </div>
        )}
        </>
        )}
      </div>

      {unlockInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-8"
          /* On a record the screen builds over the stretch before the
             track's drop, rather than cutting in fully formed while the
             music is still climbing. */
          style={
            unlockInfo.isNewPR
              ? { animation: "prBackdrop 2s ease-out both" }
              : undefined
          }
        >
          {prCinematic && (
            /* Pre-roll. Sized in viewport units throughout so it fills the
               screen on any display, rather than being a small scene in the
               middle of a large dark rectangle. */
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
              aria-hidden="true"
              style={{ animation: "prPrerollFade 7.2s ease-out both" }}
            >
              {/* A beat of true black first. The backdrop behind this is
                  only 90% opaque, so without it the page still shows
                  through and nothing feels like it stopped. */}
              <div
                className="absolute inset-0 bg-black"
                style={{ animation: "prBlackout 3.4s ease-out both" }}
              />
              {/* Vapour. Six masses spread the full width, heavily blurred
                  and drifting at different rates — slow enough to read as
                  atmosphere rather than as objects moving. */}
              {[
                { x: -46, s: 1.1, d: 0.6, dur: 6.5, c: `${PR_YELLOW}1f` },
                { x: -22, s: 0.85, d: 1.6, dur: 7, c: "#ffffff10" },
                { x: 0, s: 1.3, d: 1.2, dur: 7.5, c: "#ffffff14" },
                { x: 20, s: 0.9, d: 1.9, dur: 6, c: `${PR_YELLOW}17` },
                { x: 42, s: 1.15, d: 2.6, dur: 8, c: "#ffffff0f" },
                { x: 58, s: 1, d: 3.2, dur: 7, c: `${PR_YELLOW}14` },
              ].map(({ x, s: scale, d, dur, c }, i) => (
                <div
                  key={`v${i}`}
                  className="absolute"
                  style={{
                    width: `${52 * scale}vw`,
                    height: `${46 * scale}vh`,
                    left: `calc(50% + ${x}vw)`,
                    transform: "translateX(-50%)",
                    borderRadius: "50%",
                    background: `radial-gradient(closest-side, ${c}, transparent 70%)`,
                    filter: "blur(60px)",
                    animation: `prVapour ${dur}s ${d}s ease-out both`,
                  }}
                />
              ))}
              <div
                className="absolute rounded-full"
                style={{
                  width: "78vmax",
                  height: "78vmax",
                  background: `radial-gradient(closest-side, ${PR_YELLOW}22, ${PR_YELLOW}0b 42%, transparent 70%)`,
                  animation: "prGather 3.4s ease-out both",
                }}
              />
              {/* Sparkles across the whole field, at irregular positions. */}
              {[
                [-42, -34, 0], [38, -38, 0.5], [-46, 22, 1.1],
                [44, 26, 0.35], [-18, -42, 0.8], [22, 40, 1.4],
                [47, -12, 0.95], [-33, 38, 0.6], [8, -30, 1.25],
                [-8, 33, 0.15], [30, 8, 1.55], [-28, -8, 0.75],
              ].map(([x, y, delay], i) => (
                <div
                  key={`s${i}`}
                  className="absolute"
                  style={{
                    left: `calc(50% + ${x}vw)`,
                    top: `calc(50% + ${y}vh)`,
                    width: 12,
                    height: 12,
                    background: `radial-gradient(closest-side, ${PR_YELLOW}, transparent 70%)`,
                    animation: `prSparkle 2.2s ${delay}s ease-in-out infinite both`,
                  }}
                />
              ))}
              {/* Rings in pairs: a bright thin one with a soft wide one
                  chasing it a beat behind, so each pulse has a leading edge
                  and a wake rather than being a single hard outline. They
                  scale out past the viewport edge. */}
              {[
                { d: 0, size: 30, w: 1, blur: 0 },
                { d: 0.28, size: 30, w: 9, blur: 18 },
                { d: 1.3, size: 24, w: 1, blur: 0 },
                { d: 1.58, size: 24, w: 9, blur: 18 },
                { d: 2.6, size: 34, w: 1, blur: 0 },
                { d: 2.88, size: 34, w: 9, blur: 18 },
              ].map(({ d, size, w, blur }, i) => (
                <div
                  key={`r${i}`}
                  className="absolute rounded-full"
                  style={{
                    width: `${size}vmax`,
                    height: `${size}vmax`,
                    border: `${w}px solid ${PR_YELLOW}${blur ? "18" : "55"}`,
                    filter: blur ? `blur(${blur}px)` : undefined,
                    boxShadow: blur ? undefined : `0 0 34px ${PR_YELLOW}26`,
                    animation: `prRing 4.6s ${d}s cubic-bezier(0.19,0.75,0.28,1) both`,
                  }}
                />
              ))}
              {/* Rings travelling the other way, tightening inward from
                  beyond the edges, so the motion is not all one direction. */}
              {[0.5, 2.4].map((d) => (
                <div
                  key={`i${d}`}
                  className="absolute rounded-full"
                  style={{
                    width: "72vmax",
                    height: "72vmax",
                    border: `1px solid ${PR_YELLOW}2e`,
                    animation: `prRingIn 4s ${d}s cubic-bezier(0.33,0,0.25,1) both`,
                  }}
                />
              ))}
              {/* Motes converging from off-screen toward the centre. */}
              {Array.from({ length: 18 }).map((_, i) => {
                const angle = (i / 18) * Math.PI * 2;
                const dist = 46 + (i % 3) * 9;
                return (
                  <div
                    key={`m${i}`}
                    className="absolute rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      background: PR_YELLOW,
                      "--mx": `${(Math.cos(angle) * dist).toFixed(2)}vw`,
                      "--my": `${(Math.sin(angle) * dist).toFixed(2)}vh`,
                      /* `both` matters more than it looks: without a fill
                         mode, a mote waiting out its delay shows its
                         un-animated state — opacity 1, no transform — so all
                         eighteen sat stacked at dead centre as one small dot
                         until their turn came. */
                      animation: `prMote 2.6s ${(i % 6) * 0.28}s cubic-bezier(0.4,0,0.2,1) infinite both`,
                    }}
                  />
                );
              })}
            </div>
          )}
          {prCinematic && (
            <PrGoldGlow
              className="pointer-events-none absolute inset-0 w-full h-full"
              out={prGlowOut}
              style={{
                opacity: prRevealed ? 1 : 0,
                transition: "opacity 2s ease-out",
              }}
            />
          )}
          <div
            className="relative flex flex-col items-center text-center gap-14 max-w-sm"
            style={
              prCinematic
                ? {
                    // Resolves ON the drop. A transition rather than an
                    // animation, so its end state is simply the element's
                    // normal appearance and it cannot be left mid-way.
                    opacity: prRevealed ? 1 : 0,
                    transform: prRevealed
                      ? "translateY(0) scale(1)"
                      : "translateY(26px) scale(0.94)",
                    filter: prRevealed ? "blur(0px)" : "blur(14px)",
                    // Long, and eased so almost all the movement happens
                    // early and it drifts into place — an abrupt arrival is
                    // usually a curve that finishes fast, not one that is
                    // too short.
                    transition:
                      "opacity 5s cubic-bezier(0.16,0.8,0.24,1), transform 5s cubic-bezier(0.16,0.8,0.24,1), filter 4.2s cubic-bezier(0.16,0.8,0.24,1)",
                  }
                : undefined
            }
          >
            {unlockInfo.isNewPR ? (
              <div
                className="text-2xl font-semibold uppercase tracking-widest mb-2"
                style={{
                  color: PR_YELLOW,
                  textShadow: `0 0 24px ${PR_YELLOW}66`,
                }}
              >
                New personal record
              </div>
            ) : (
              <div className="text-base uppercase tracking-wide text-slate-400">
                Level up
              </div>
            )}

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
                // The tune, not the click: this button is the moment the
                // reward is collected, so it should sound like one every
                // time it is pressed.
                playLevelUp();
                // Take the music out with the screen rather than cutting it
                // dead or leaving it running over whatever comes next.
                fadeOutCelebrationSong();
                setUnlockInfo(null);
                checkForNewAchievements();
              }}
              className={`w-full max-w-xs bg-gradient-to-r ${
                ACCENT_STYLES[EXERCISE_LIBRARY[unlockInfo.exerciseKey]?.accent]?.grad ||
                ACCENT_STYLES.indigo.grad
              } hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
            >
              Nice!
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
              className="relative flex flex-col items-center text-center gap-10 max-w-md px-6 py-4"
              style={{ animation: "celebrationPop 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}
            >
              <div className="text-base uppercase tracking-wide text-indigo-300 font-semibold">
                Achievement unlocked
              </div>

              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl bg-gradient-to-br ${groupAccent.grad} shadow-2xl shadow-black/40`}
              >
                {current.icon}
              </div>

              <div className="space-y-3">
                <AchievementTitle
                  achievement={current}
                  className="text-3xl font-semibold tracking-tight"
                />
                <div className="text-slate-400 text-base">{current.description}</div>
                {current.reward && (
                  <div className={`italic text-sm mt-1 ${groupAccent.text}`}>
                    Unlocks: {current.reward}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  playLevelUp();
                  setAchievementCelebrationQueue((q) => q.slice(1));
                }}
                className={`w-full max-w-xs bg-gradient-to-r ${groupAccent.grad} hover:opacity-90 transition-opacity rounded-lg py-5 font-medium text-xl shadow-lg shadow-black/30`}
              >
                Nice!
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
                <AchievementTitle
                  achievement={a}
                  className="text-2xl font-semibold tracking-tight"
                />
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
                  ? "You trained today, streak's safe!"
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

      {/* End-of-session celebration. Sits between the Overview screen and
          the Motivation screen so finishing a regime lands as a moment
          rather than a silent navigation. Pointer events off so it can never
          trap a click if the timer is somehow missed. */}
      {sessionCompleteAnim && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm pointer-events-none overflow-hidden">
          {/* A wash of light behind everything, so the screen brightens
              before anything is drawn on it. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(42% 34% at 50% 44%, rgba(76,185,216,0.30) 0%, rgba(76,185,216,0.10) 45%, transparent 72%)",
              animation: "sessionDoneWash 6.2s cubic-bezier(0.2,0.7,0.3,1) forwards",
            }}
          />
          <div className="relative flex items-center justify-center">
            <span
              className="absolute w-44 h-44 rounded-full border border-cyan-400/50"
              style={{ animation: "sessionDoneRing 2.2s ease-out 0.55s forwards" }}
            />
            <span
              className="absolute w-44 h-44 rounded-full border border-cyan-400/30"
              style={{ animation: "sessionDoneRing 2.2s ease-out 0.95s forwards" }}
            />
            {/* Sparks thrown out on the beat the mark lands. */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const dist = 96 + (i % 3) * 26;
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className="absolute rounded-full bg-cyan-300"
                  style={{
                    width: 5,
                    height: 5,
                    "--sx": `${(Math.cos(angle) * dist).toFixed(1)}px`,
                    "--sy": `${(Math.sin(angle) * dist).toFixed(1)}px`,
                    animation: `sessionDoneSpark 1.5s ${0.62 + (i % 4) * 0.04}s cubic-bezier(0.2,0.7,0.3,1) both`,
                  }}
                />
              );
            })}
            {/* The ring draws itself closed. Circumference of r=48 is about
                302, which is where the dash numbers come from. */}
            <svg width="112" height="112" viewBox="0 0 112 112" className="absolute">
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="#4CB9D8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="302"
                transform="rotate(-90 56 56)"
                style={{ animation: "sessionDoneTrace 0.75s cubic-bezier(0.4,0,0.2,1) both" }}
              />
            </svg>
            <div
              className="w-28 h-28 rounded-full bg-cyan-500/10 flex items-center justify-center text-5xl text-cyan-300"
              style={{ animation: "sessionDoneMark 0.6s 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}
            >
              ✓
            </div>
          </div>
          <div className="mt-12 text-center">
            <div
              className="text-4xl font-semibold tracking-tight"
              style={{ animation: "sessionDoneText 6.2s ease-out forwards" }}
            >
              Session complete
            </div>
            <div
              className="text-slate-400 text-lg mt-3 max-w-md mx-auto px-6"
              style={{
                animation: "sessionDoneSub 6.2s ease-out forwards",
                textWrap: "balance",
              }}
            >
              {sessionNudgeLine}
            </div>
          </div>
        </div>
      )}

      {SHOW_LEADERBOARD && mainView === "home" && (
        <button
          onClick={() => setMainView("leaderboard")}
          className="fixed top-3 right-3 sm:top-6 sm:right-6 z-30 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all duration-200 hover:scale-105 hover:shadow-xl rounded-full py-2 px-3 sm:py-3 sm:px-5 text-sm sm:text-base font-medium shadow-lg"
        >
          <span>🏆</span>
          <span className="hidden sm:inline">Leaderboard</span>
        </button>
      )}

      {/* Testing convenience — jumps straight to the next exercise in the
          regime (same mechanic as forceSwitchToNext everywhere else,
          including the tutorial-screen gate) without needing to sit through
          the current one's full duration. Shown on every exercise page
          (setup/running/results, and RRT/3D MOT's own self-contained
          screens) rather than duplicated per-screen, so there's exactly one
          place this can go stale. Hidden during the brief switchNotice
          transition since forceSwitchToNext is already mid-flight then. */}
      {mainView === "app" && !switchNotice && exercise.key !== "overview" && (
        <button
          onClick={() => forceSwitchToNext(exerciseIndex)}
          className="fixed top-2 right-2 md:top-6 md:right-6 flex items-center gap-2 border border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400 bg-slate-900/90 backdrop-blur transition-colors rounded-full py-1.5 md:py-2.5 px-3 md:px-5 text-xs md:text-sm font-medium shadow-lg z-30"
        >
          🧪 Skip to next exercise
        </button>
      )}

      {mainView === "home" && (
        <button
          onClick={() => setMainView("achievements")}
          /* Top right while the Leaderboard is hidden. When that comes back it
             takes this corner and Achievements returns to the left. */
          className="fixed top-3 right-3 sm:top-6 sm:right-6 z-30 flex items-center gap-1.5 sm:gap-2.5 bg-cyan-500/10 border border-cyan-400 text-cyan-300 transition-all duration-200 hover:scale-105 rounded-full py-2 px-3 sm:py-3 sm:px-6 text-sm sm:text-base font-medium shadow-lg shadow-black/40 hover:shadow-xl"
        >
          <span className="text-lg">🏅</span>
          <span className="hidden sm:inline">Achievements</span>
          <span className="text-xs font-semibold bg-cyan-500/10 text-cyan-300 rounded-full px-2 py-0.5">
            {ACHIEVEMENTS_CATALOG.filter((a) => isAchievementUnlocked(a, achievementState)).length}/
            {ACHIEVEMENTS_CATALOG.length}
          </span>
        </button>
      )}

      {mainView === "home" && (
        <button
          onClick={() => setMainView("account")}
          className="fixed bottom-6 right-6 flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all duration-200 hover:scale-105 hover:shadow-xl rounded-full py-3 px-7 text-base font-medium shadow-lg"
        >
          {SHOW_PROFILE_IDENTITY_EDIT && (
            <AvatarFrame tier={ownAvatarFrameTier}>
              <Avatar avatarId={selectedAvatarId} imageUrl={customAvatarImage} size={24} />
            </AvatarFrame>
          )}
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
          className="fixed bottom-6 left-6 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all duration-200 hover:scale-105 hover:shadow-xl rounded-full py-3 px-5 text-base font-medium shadow-lg"
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
                  placeholder="What do you want added / changed?"
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
// How many wrong or missed answers in a row force the difficulty back down a
// step. Three was too tight: a couple of unlucky rounds at a newly-reached
// premise count dropped the level before there was any evidence the person
// couldn't hold it, which is demoralising and slows real progress. Ten means
// a drop reflects a genuine plateau rather than a bad patch.
// Fixed height for the premise/conclusion line. Its contents vary — letter
// tags are shorter than tiles, and a long proposition wraps to two rows — and
// without this the card grew and shrank between premises, nudging the Back and
// Next buttons a few pixels each time.
const RRT_PROPOSITION_MIN_HEIGHT = 104;

const RRT_DROP_AFTER_WRONG = 10;

const RRT_FOOTER_MIN_HEIGHT = 116;

function RRTExercise({ exercise, onFinish, onStageChange, onLevelUp, onSessionEnd, paused, scrambleFactor = 0, branchingEnabled = true, autoStart = 0 }) {
  const accent = ACCENT_STYLES[exercise.accent];
  const [stage, setStage] = useState("setup"); // setup | premises | question
  const [puzzle, setPuzzle] = useState(null);
  const [premiseIndex, setPremiseIndex] = useState(0);
  // Back stays locked until every premise has been read once, so the round
  // cannot be answered by flicking back and forth instead of holding them.
  const [maxPremiseSeen, setMaxPremiseSeen] = useState(0);
  const [answeredAny, setAnsweredAny] = useState(() => {
    try {
      return localStorage.getItem(RRT_ANSWERED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const markAnswered = () => {
    setAnsweredAny(true);
    try {
      localStorage.setItem(RRT_ANSWERED_KEY, "1");
    } catch {
      /* no persistence: the hint just waits for this session's first answer */
    }
  };
  // Back is locked until the conclusion has been reached once, so a round
  // cannot be worked by flicking between premises instead of holding them.
  const [reachedQuestion, setReachedQuestion] = useState(false);

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
  // Tracks whether the open explanation came from a hover (transient) or a
  // click (pinned), so leaving the button only closes the transient one.
  const [explanationHover, setExplanationHover] = useState(null);

  const pushRoundHistory = (userAnswer, correct) => {
    if (!puzzle) return;
    setRoundHistory((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          puzzleType: puzzle.puzzleType,
          items: puzzle.items,
          premises: puzzle.premises,
          positions: puzzle.positions, // space2d only — the grid the map is drawn from

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
      setMaxPremiseSeen(0);
      setReachedQuestion(false);
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
  // Bumped by the parent when the tutorial finishes, so "I Get It" drops
  // straight into a round instead of the setup screen.
  // Layout effect, not a plain one: a plain effect runs after paint, which
  // showed the setup screen for a frame before the round replaced it.
  useLayoutEffect(() => {
    if (autoStart > 0) beginRoundRef.current(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);
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
        if (nextWrong >= RRT_DROP_AFTER_WRONG) {
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

  // The other direction — RRT_DROP_AFTER_WRONG wrong/missed in a row (see wrongStreak
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

  // Dev/test-only: sets the difficulty ladder straight to 7p / 30s. Same
  // shape as triggerRrtIncrement so it threads through triggerFlash the same
  // way, regenerating the round on screen rather than only bumping state.
  const jumpRrtTo7p = () => {
    const targetCount = 15; // 2 + floor(15 / 3) = 7 premises, 15 % 3 = 0 -> 30s
    setRrtIncrementCount(targetCount);
    const premiseCount = 2 + Math.floor(targetCount / 3);
    const roundMs = (30 - (targetCount % 3) * 5) * 1000;
    onLevelUp?.(premiseCount - 1, `RRT ${premiseCount}p ${roundMs / 1000}s`);
    return { premiseCount, roundMs };
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
      // Wrong answers in a row force the difficulty back down one step — the
      // mirror of the 20-correct step-up above.
      if (nextWrong >= RRT_DROP_AFTER_WRONG) {
        override = triggerRrtDecrement();
        setWrongStreak(0);
      } else {
        setWrongStreak(nextWrong);
      }
    }
    markAnswered();
    triggerFlash(correct ? "correct" : "wrong", override);
  };

  const secondsLeft = Math.ceil(msLeft / 1000);

  // A pointer at the timer checkbox, because nothing else on the screen says
  // that is how a round starts. Dismissed for good by its own tick box.
  const [hideTimerHint, setHideTimerHint] = useState(() => {
    try {
      return localStorage.getItem(RRT_TIMER_HINT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissTimerHint = () => {
    setHideTimerHint(true);
    try {
      localStorage.setItem(RRT_TIMER_HINT_KEY, "1");
    } catch {
      /* a session without persistence just sees it again next time */
    }
  };
  const showTimerHint = !hideTimerHint && !timerRunning && !flash;

  // A second pointer, at History, shown once the first round has been
  // answered. Its own tick box, its own storage key.
  const [hideHistoryHint, setHideHistoryHint] = useState(() => {
    try {
      return localStorage.getItem(RRT_HISTORY_HINT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissHistoryHint = () => {
    setHideHistoryHint(true);
    try {
      localStorage.setItem(RRT_HISTORY_HINT_KEY, "1");
    } catch {
      /* a session without persistence just sees it again next time */
    }
  };
  // Gated on the History list actually having something in it, which is the
  // same state the panel itself reads — no separate flag to fall out of sync.
  const showHistoryHint = !hideHistoryHint && !flash && roundHistory.length > 0;

  // A third pointer, on the left, explaining why Back is dead until the
  // conclusion has been reached.
  const [hideBackHint, setHideBackHint] = useState(() => {
    try {
      return localStorage.getItem(RRT_BACK_HINT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissBackHint = () => {
    setHideBackHint(true);
    try {
      localStorage.setItem(RRT_BACK_HINT_KEY, "1");
    } catch {
      /* a session without persistence just sees it again next time */
    }
  };
  const showBackHint = !hideBackHint && !flash && !reachedQuestion;

  if (stage === "setup") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{exercise.title}</h1>
        </div>

        {/* Exactly the construction the N-back setup card uses — the
            exercise's own tinted fill and border, not a one-off. */}
        <div className={`${accent.bg} border ${accent.border} rounded-xl p-6 space-y-3`}>
          <div className="text-lg text-slate-300">
            Premises: <span className="text-slate-100 font-medium">{premiseCount}p</span>
          </div>
          <div className="text-lg text-slate-400">
            Round length: <span className="text-slate-200 font-medium">{ROUND_MS / 1000} sec</span>
          </div>
          <p className="text-slate-400 text-base">
            20 in a row = level up. 30s, 25s, 20s, +1 premise.
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
            onClick={() => {
              setTimerRunning(false);
              setHistoryOpen(true);
            }}
            className="no-lift text-sm text-slate-400 hover:text-slate-200 underline decoration-dotted underline-offset-2 transition-colors"
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
        <div
          className="fixed inset-0 z-40 bg-black/80 flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl">
              <div className="font-semibold text-slate-100 text-xl uppercase" style={{ letterSpacing: "0.18em" }}>History</div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-4xl leading-none px-3 py-1 -my-1 transition-colors"
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
                    className="rounded-xl border p-5 space-y-4 bg-slate-950"
                    style={{
                      borderColor: missed
                        ? RRT_TIMEOUT
                        : entry.correct
                        ? RRT_GREEN
                        : RRT_RED,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm font-semibold uppercase" style={{ letterSpacing: "0.14em" }}>
                        Round {roundHistory.length - i}
                      </span>
                      <span
                        className="text-sm font-bold uppercase rounded-full px-3 py-1"
                        style={{
                          letterSpacing: "0.12em",
                          color: "#F7F8F8",
                          backgroundColor: missed
                            ? RRT_TIMEOUT
                            : entry.correct
                            ? RRT_GREEN
                            : RRT_RED,
                        }}
                      >
                        {missed ? "Missed" : entry.correct ? "Correct" : "Wrong"}
                      </span>
                    </div>
                    <div className="space-y-2.5 text-lg text-slate-100">
                      <div className="text-slate-300 uppercase text-sm tracking-wide font-semibold">
                        Premises
                      </div>
                      {entry.premises.map((p, pi) => (
                        <div key={pi} className="flex items-center gap-3 flex-wrap">
                          <RrtHistoryItemChip item={p.subject} onClick={setHistoryItemPopup} />
                          <span className="font-medium">{rrtRelationPhrase(p.relation)}</span>
                          <RrtHistoryItemChip item={p.object} onClick={setHistoryItemPopup} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2.5 text-lg text-slate-100 pt-3 border-t border-slate-800">
                      <div className="text-slate-300 uppercase text-sm tracking-wide font-semibold">
                        Conclusion
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <RrtHistoryItemChip item={entry.conclusion.subject} onClick={setHistoryItemPopup} />
                        <span className="font-medium">{rrtRelationPhrase(entry.conclusion.relation)}</span>
                        <RrtHistoryItemChip item={entry.conclusion.object} onClick={setHistoryItemPopup} />
                        <span className="font-medium">?</span>
                      </div>
                    </div>
                    {/* Answer readout as a label/value grid: muted small-caps
                        labels on the left, the value carrying the colour, so the
                        three lines line up instead of running together as bold
                        sentences. */}
                    <div className="pt-2 border-t border-slate-800 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
                      <span className="text-slate-400 text-sm font-semibold uppercase" style={{ letterSpacing: "0.12em" }}>
                        Your answer
                      </span>
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{
                          color: missed
                            ? RRT_TIMEOUT
                            : entry.userAnswer
                            ? RRT_GREEN
                            : RRT_RED,
                        }}
                      >
                        {missed ? "Missed" : entry.userAnswer ? "TRUE" : "FALSE"}
                      </span>
                      <span className="text-slate-400 text-sm font-semibold uppercase" style={{ letterSpacing: "0.12em" }}>
                        Correct
                      </span>
                      <span
                        className="text-lg font-bold"
                        style={{ color: entry.conclusion.answer ? RRT_GREEN : RRT_RED }}
                      >
                        {entry.conclusion.answer ? "TRUE" : "FALSE"}
                      </span>
                      <span className="text-slate-400 text-sm font-semibold uppercase" style={{ letterSpacing: "0.12em" }}>
                        Time
                      </span>
                      <span className="text-lg text-slate-100 tabular-nums">
                        {(entry.responseTimeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400 text-base font-medium">
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
                        onMouseEnter={() => {
                          if (!rrtHasRealPointer()) return;
                          setExplanationHover(entry);
                          setExplanationFor(entry);
                        }}
                        onMouseLeave={() => {
                          if (!rrtHasRealPointer()) return;
                          // Only close what the hover itself opened — if the
                          // panel was pinned by a click, moving the mouse away
                          // shouldn't dismiss it.
                          setExplanationHover((hovered) => {
                            if (hovered === entry) setExplanationFor(null);
                            return null;
                          });
                        }}
                        className="bg-teal-700 hover:bg-teal-600 transition-colors rounded-lg px-5 py-2 text-base font-medium"
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

      {explanationFor && (() => {
      const explanationIsVertical = explanationFor.puzzleType === "vertical";
      return (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          style={explanationHover ? { pointerEvents: "none" } : undefined}
          onClick={() => {
            setExplanationHover(null);
            setExplanationFor(null);
          }}
        >
          <div
            className={`bg-slate-900 border border-slate-700 rounded-2xl w-full ${
              explanationIsVertical ? "p-6" : "p-5"
            }`}
            style={{
              maxWidth: explanationIsVertical ? "15rem" : "42rem",
              width: "fit-content",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const explanation = buildRrtExplanationChain(explanationFor);
              if (explanation.puzzleType === "space2d") {
                return (
                  <div className="overflow-x-auto">
                    <div
                      className="mx-auto"
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${explanation.cols}, 4.25rem)`,
                        gridTemplateRows: `repeat(${explanation.rows}, 4.25rem)`,
                        gap: 0,
                        borderTop: "1px solid #3A3D44",
                        borderLeft: "1px solid #3A3D44",
                        width: "fit-content",
                      }}
                    >
                      {Array.from({ length: explanation.cols * explanation.rows }).map((_, idx) => {
                        const col = idx % explanation.cols;
                        const row = Math.floor(idx / explanation.cols);
                        const here = explanation.cells.find((c) => c.col === col && c.row === row);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-center"
                            style={{
                              borderRight: "1px solid #3A3D44",
                              borderBottom: "1px solid #3A3D44",
                            }}
                          >
                            {here ? (
                              here.item.type === "voronoi" ? (
                                <RrtItemTile item={here.item} size={46} />
                              ) : (
                                <div className="text-slate-100 font-bold text-lg tracking-wide">
                                  {here.item.letters}
                                </div>
                              )
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              const orderConfig = RRT_ORDER_CONFIGS[explanation.puzzleType];
              if (orderConfig) {
                const isVertical = explanation.puzzleType === "vertical";
                return (
                  <div
                    className={
                      isVertical
                        ? "flex flex-col items-center gap-2 overflow-y-auto"
                        : "flex items-center justify-center gap-2.5 flex-wrap"
                    }
                    style={isVertical ? { maxHeight: "70vh" } : undefined}
                  >
                    {explanation.chainItems.map((it, idx) => (
                      <Fragment key={idx}>
                        {idx > 0 && !isVertical && (
                          <span
                            className={`text-slate-400 font-semibold select-none ${
                              isVertical ? "text-base leading-none" : "text-xl"
                            }`}
                            aria-hidden="true"
                          >
                            {isVertical
                              ? "\u2193"
                              : explanation.puzzleType === "comparison"
                              ? ">"
                              : "\u203A"}
                          </span>
                        )}
                        <div>
                          {it.type === "voronoi" ? (
                            <RrtItemTile item={it} size={46} />
                          ) : (
                            <div
                              className="text-slate-100 font-bold text-lg tracking-wide"
                            >
                              {it.letters}
                            </div>
                          )}
                        </div>
                      </Fragment>
                    ))}
                  </div>
                );
              }
              const { groups } = explanation;
              return (
                <div className="flex items-stretch justify-center gap-2">
                  {groups.map((group, gi) => (
                    <div
                      key={gi}
                      className={`flex flex-col items-center gap-3 px-5 ${
                        gi > 0 ? "border-l border-slate-700" : ""
                      }`}
                    >
                      {group
                        .filter((it) => it.type === "voronoi")
                        .map((it, idx) => (
                          <RrtItemTile key={idx} item={it} size={46} />
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
          </div>
        </div>
      );
      })()}

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
                {historyItemPopup.colorName} tile
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


  // The pointer at the timer checkbox. Outside the card because the card
  // clips its own overflow. On a narrow screen there is no room beside it,
  // so it drops underneath instead.
  const timerHint = showTimerHint ? (
    <>
      <div className="hidden lg:block absolute left-full top-[6.4rem] ml-3 w-60">
        <svg
          width="58"
          height="22"
          viewBox="0 0 58 22"
          fill="none"
          className="absolute pointer-events-none"
          style={{ left: -44, top: 6 }}
          aria-hidden="true"
        >
          <path
            d="M56 18C56 18 42 4 5 4"
            stroke={EXERCISE_COLORS.rrt}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 1 4 4 11 9"
            stroke={EXERCISE_COLORS.rrt}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="rounded-lg px-3 py-2 border text-sm"
          style={{
            borderColor: `${EXERCISE_COLORS.rrt}66`,
            background: "#0F1115",
            color: "#F7F8F8",
          }}
        >
          <div>Tick this to start the round.</div>
          <label className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={false}
              onChange={dismissTimerHint}
              className="w-4 h-4 rounded border-slate-500 bg-slate-800 accent-slate-400"
            />
            Don't show again
          </label>
        </div>
      </div>
      <div
        className="lg:hidden absolute top-full left-0 right-0 mt-3 rounded-lg px-3 py-2 border text-sm"
        style={{
          borderColor: `${EXERCISE_COLORS.rrt}66`,
          background: "#0F1115",
          color: "#F7F8F8",
        }}
      >
        <div>Tick the box next to TIMER to start the round.</div>
        <label className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={false}
            onChange={dismissTimerHint}
            className="w-4 h-4 rounded border-slate-500 bg-slate-800 accent-slate-400"
          />
          Don't show again
        </label>
      </div>
    </>
  ) : null;

  const backHint = showBackHint ? (
    <>
      <div className="hidden lg:block absolute right-full bottom-[6.5rem] mr-3 w-56">
        <svg
          width="46"
          height="22"
          viewBox="0 0 46 22"
          fill="none"
          className="absolute pointer-events-none"
          style={{ right: -38, top: 6 }}
          aria-hidden="true"
        >
          <path
            d="M2 18C2 18 18 4 41 4"
            stroke={EXERCISE_COLORS.rrt}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M34 1 42 4 35 9"
            stroke={EXERCISE_COLORS.rrt}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="rounded-lg px-3 py-2 border text-sm"
          style={{
            borderColor: `${EXERCISE_COLORS.rrt}66`,
            background: "#0F1115",
            color: "#F7F8F8",
          }}
        >
          <div>Can't press back until you've constructed the spatial model.</div>
          <label className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={false}
              onChange={dismissBackHint}
              className="w-4 h-4 rounded border-slate-500 bg-slate-800 accent-slate-400"
            />
            Don't show again
          </label>
        </div>
      </div>
      <div
        className="lg:hidden absolute top-full left-0 right-0 mt-48 rounded-lg px-3 py-2 border text-sm"
        style={{
          borderColor: `${EXERCISE_COLORS.rrt}66`,
          background: "#0F1115",
          color: "#F7F8F8",
        }}
      >
        <div>Can't press back until you've constructed the spatial model.</div>
        <label className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={false}
            onChange={dismissBackHint}
            className="w-4 h-4 rounded border-slate-500 bg-slate-800 accent-slate-400"
          />
          Don't show again
        </label>
      </div>
    </>
  ) : null;

  const historyHint = showHistoryHint ? (
    <>
      <div className="hidden lg:block absolute left-full top-[1.75rem] ml-3 w-60">
        <svg
          width="46"
          height="22"
          viewBox="0 0 46 22"
          fill="none"
          className="absolute pointer-events-none"
          style={{ left: -38, top: 6 }}
          aria-hidden="true"
        >
          <path
            d="M44 18C44 18 28 4 5 4"
            stroke={EXERCISE_COLORS.rrt}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 1 4 4 11 9"
            stroke={EXERCISE_COLORS.rrt}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="rounded-lg px-3 py-2 border text-sm"
          style={{
            borderColor: `${EXERCISE_COLORS.rrt}66`,
            background: "#0F1115",
            color: "#F7F8F8",
          }}
        >
          <div>Check History to see if your spatial model is accurate.</div>
          <label className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={false}
              onChange={dismissHistoryHint}
              className="w-4 h-4 rounded border-slate-500 bg-slate-800 accent-slate-400"
            />
            Don't show again
          </label>
        </div>
      </div>
      <div
        className="lg:hidden absolute top-full left-0 right-0 mt-24 rounded-lg px-3 py-2 border text-sm"
        style={{
          borderColor: `${EXERCISE_COLORS.rrt}66`,
          background: "#0F1115",
          color: "#F7F8F8",
        }}
      >
        <div>Check History to see if your spatial model is accurate.</div>
        <label className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={false}
            onChange={dismissHistoryHint}
            className="w-4 h-4 rounded border-slate-500 bg-slate-800 accent-slate-400"
          />
          Don't show again
        </label>
      </div>
    </>
  ) : null;

  // Verdict flash: a tinted wash plus a hard inset ring in the verdict colour,
  // with the label set small and letter-spaced over it. The puzzle stays
  // readable underneath instead of being painted out by a full-bleed block
  // with an emoji on it.
  const flashColor =
    flash === "correct" ? RRT_GREEN : flash === "wrong" ? RRT_RED : RRT_TIMEOUT;
  const flashOverlay = flash && (
    <div
      className="absolute inset-0 rounded-2xl flex items-center justify-center z-10 rrt-flash"
      style={{
        backgroundColor: `${flashColor}33`,
        boxShadow: `inset 0 0 0 2px ${flashColor}, inset 0 0 60px ${flashColor}55`,
        backdropFilter: "blur(1px)",
      }}
    >
      <div
        className="text-base font-semibold uppercase px-5 py-2 rounded-lg"
        style={{
          letterSpacing: "0.3em",
          color: "#F7F8F8",
          backgroundColor: `${flashColor}`,
        }}
      >
        {flash === "correct" ? "Correct" : flash === "wrong" ? "Wrong" : "Missed"}
      </div>
    </div>
  );

  if (stage === "premises") {
    const premise = puzzle.premises[puzzle.premiseOrder[premiseIndex]];
    const isFirst = premiseIndex === 0;
    const isLast = premiseIndex === puzzle.premises.length - 1;
    return (
      <div className="relative max-w-sm mx-auto">
        {flashOverlay}
        {timerHint}
        {historyHint}
        {backHint}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl shadow-black/40 overflow-hidden">
          <div className="p-6 flex flex-col">
            <div className="space-y-5">
              {timerHeader}

              <div className="flex items-center justify-between">
                <div className="italic font-bold tracking-wide text-slate-300 text-lg">
                  PREMISE
                </div>
                <div className="text-slate-200 text-xl font-semibold">
                  {premiseIndex + 1} / {puzzle.premises.length}
                </div>
              </div>

              <div
                className="flex items-center justify-center gap-3.5 py-5 px-1 flex-wrap text-center"
                style={{ minHeight: RRT_PROPOSITION_MIN_HEIGHT }}
              >
                <RrtItemTile item={premise.subject} size={46} />
                <span className="text-slate-100 text-2xl font-medium">
                  {rrtRelationPhrase(premise.relation)}
                </span>
                <RrtItemTile item={premise.object} size={46} />
              </div>
            </div>

            <div
              className="flex flex-col justify-start gap-3 mt-4"
              style={{ minHeight: RRT_FOOTER_MIN_HEIGHT }}
            >
              <div className="flex gap-3">
                <button
                  onClick={() => setPremiseIndex((i) => Math.max(0, i - 1))}
                  disabled={isFirst || !reachedQuestion}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 transition-colors rounded-lg py-2 text-base font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (isLast) {
                      setReachedQuestion(true);
                      setStage("question");
                    } else {
                      setPremiseIndex((i) => i + 1);
                      setMaxPremiseSeen((m) => Math.max(m, premiseIndex + 1));
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
            onClick={() => {
              setCorrectStreak(0);
              const override = jumpRrtTo7p();
              triggerFlash("correct", override);
            }}
            className="flex-1 border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 text-sm"
          >
            🧪 Skip to 7p
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
    <div className="relative max-w-sm mx-auto">
      {flashOverlay}
      {timerHint}
      {historyHint}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl shadow-black/40 overflow-hidden">
        <div className="p-6 flex flex-col">
          <div className="space-y-5">
            {timerHeader}

            <div className="text-center">
              <div className={`italic font-bold tracking-wide text-lg ${accent.text}`}>
                CONCLUSION
              </div>
            </div>

            <div
              className="flex items-center justify-center gap-3.5 py-5 px-1 flex-wrap text-center"
              style={{ minHeight: RRT_PROPOSITION_MIN_HEIGHT }}
            >
              <RrtItemTile item={conclusion.subject} size={46} />
              <span className="text-slate-100 text-2xl font-medium">
                {rrtRelationPhrase(conclusion.relation)}
              </span>
              <RrtItemTile item={conclusion.object} size={46} />
              <span className="text-slate-100 text-2xl font-medium">?</span>
            </div>
          </div>

          <div
            className="flex flex-col justify-start gap-3 mt-4"
            style={{ minHeight: RRT_FOOTER_MIN_HEIGHT }}
          >
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPremiseIndex(puzzle.premises.length - 1);
                  setMaxPremiseSeen(puzzle.premises.length - 1);
                  setReachedQuestion(true);
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

            <div className="flex gap-3">
              <button
                onClick={() => answer(true)}
                style={{ backgroundColor: RRT_GREEN }}
                className="flex-1 transition-colors rounded-lg py-2 text-base font-medium"
              >
                True
              </button>
              <button
                onClick={() => answer(false)}
                style={{ backgroundColor: RRT_RED }}
                className="flex-1 transition-colors rounded-lg py-2 text-base font-medium"
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
          onClick={() => {
            setCorrectStreak(0);
            const override = jumpRrtTo7p();
            triggerFlash("correct", override);
          }}
          className="flex-1 border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors rounded-lg py-2 text-sm"
        >
          🧪 Skip to 7p
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
const MOT_CUBE_HALF = 2.6; // half-extent of the bounding cube along each axis — sized against MOT_BALL_RADIUS so the interior doesn't read as empty
const MOT_CUBE_HALF_X = MOT_CUBE_HALF * 1.4; // wider left/right than the other two axes — same cube, stretched only on X
const MOT_BALL_RADIUS = 0.34;
const MOT_CAMERA_FOV = 62; // vertical field of view, degrees
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
// The same green and red RRT uses for a right and a wrong answer, so one
// signal means one thing across the whole app.
const MOT_COLOR_CORRECT = 0x1e982b;
const MOT_COLOR_WRONG = 0x971426;
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
function motRandomPointInCube(margin, halfX) {
  const span = MOT_CUBE_HALF - margin;
  const spanX = halfX - margin;
  return new THREE.Vector3(
    (Math.random() * 2 - 1) * spanX,
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
const MOT_MIN_CANVAS_DIM = 220;

// Home-row keys (plus "i", the natural 10th neighbor) — one letter per
// ball, so picking a target is a single keypress without needing to look
// down at the keyboard. Shuffled once per mount (see the ball-creation
// loop below) and kept stable for the whole session; it's just a fixed
// label identifying which ball is which; it doesn't need to change round
// to round for the mechanic to work.
const MOT_KEY_LETTERS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", "i"];

// Solves for the camera distance that mathematically guarantees the whole
// cube (every ball included, at any position it can legally occupy) stays
// inside the view frustum, for the CURRENT aspect ratio — rather than a
// fixed distance eyeballed against one screenshot's aspect ratio, which is
// exactly why this kept clipping differently on different screen shapes.
//
// The worst case for each axis is a ball simultaneously at that axis's
// extreme AND at max Z (closest to the camera, since the cube has real
// depth too) — that's the shortest possible camera-to-ball distance
// combined with the largest possible off-axis offset, i.e. the case most
// likely to fall outside the frustum. A ball's surface can reach exactly
// the cube's half-extent (its center is clamped to half-extent minus its
// own radius, see the `bound`/`boundX` clamps in the animation loop), so
// the cube's half-extents ARE the values that need to stay inside frame —
// no separate radius term needed.
//
// For each axis: requiring (cameraDistance - MOT_CUBE_HALF) * tanHalfFov
// >= thatAxis'sHalfExtent, solved for cameraDistance, gives the minimum
// distance that keeps it fully framed. Takes the larger of the vertical
// and horizontal requirements, then adds a small safety margin.
// Scroll-zoom bounds, as multipliers on the computed fit-the-box distance:
// 0.45 is about as close as you can get before the camera crosses the front
// wall, 2.2 is far enough back to see the whole room with margin.
// Widest the room is ever allowed to get, as a multiple of its Y/Z
// half-extent. Without a ceiling the room tracked the viewport aspect ratio
// without limit, so an ultrawide window produced a room stretched more than
// 2:1 — a letterbox slot rather than a box.
const MOT_CUBE_HALF_X_MAX = MOT_CUBE_HALF * 1.5;

// Room X half-extent for a given canvas size: tracks the viewport aspect
// ratio so a wider screen gets a wider room, but clamped at both ends so the
// proportions stay box-like. Beyond the cap the extra width becomes margin
// around the room instead of more room.
function motCubeHalfX(width, height) {
  return Math.min(
    MOT_CUBE_HALF_X_MAX,
    Math.max(MOT_CUBE_HALF_X, MOT_CUBE_HALF * (width / height))
  );
}

const MOT_ZOOM_MIN = 0.45;
const MOT_ZOOM_MAX = 2.2;

function computeMotionCameraDistance(width, height, fovDeg, cubeHalfX) {
  const aspect = width / height;
  const tanHalfV = Math.tan((fovDeg * Math.PI) / 360);
  const tanHalfH = tanHalfV * aspect;
  const distV = MOT_CUBE_HALF / tanHalfV + MOT_CUBE_HALF;
  const distH = cubeHalfX / tanHalfH + MOT_CUBE_HALF;
  return Math.max(distV, distH) * 1.06; // small safety margin on top of the exact minimum
}

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


// =======================================================================
// Hypnosis / motivation module
// =======================================================================
// Shown once at the end of a completed session (the Overview screen's "Home"
// button routes here instead of straight home), so it lands while the effort
// is still fresh rather than competing with the decision to start training.
// The track lives in public/audio. The filename has spaces, so it is
// percent-encoded here rather than relying on the browser to do it.
const HYPNOSIS_TRACK = {
  url: "/audio/Cortex%20Hypnosis%20v9.mp3",
  title: "Motivation",
  length: "10 min",
  // Known length, so the bar reads correctly before metadata arrives instead
  // of showing 0:00 and then jumping.
  seconds: 631,
  blurb:
    "A guided motivation audio. There's no need to do it every day. Use it when you want an extra boost. Results are best in the morning and at night right before sleep.",
};

// Deliberately bare: a play button and a volume slider, nothing else. No
// scrubber, no timestamps — this is a track to sit through rather than one to
// navigate around, and a progress bar invites checking how long is left.
function HypnosisScreen({ onDone, afterSession }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(HYPNOSIS_TRACK.seconds);

  // Stop on leaving, so it cannot keep playing underneath the rest of the app.
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) el.pause();
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = volume;
  }, [volume]);

  // Click or drag anywhere on the bar to move. Pointer events rather than
  // click alone, so dragging scrubs continuously instead of only landing
  // where the finger lifts.
  const scrubTo = (clientX, el) => {
    const audio = audioRef.current;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const target = ratio * (audio?.duration || duration || 0);
    if (audio && isFinite(target)) audio.currentTime = target;
    setElapsed(target);
  };

  const fmt = (secs) => {
    if (!secs || !isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    return `${m}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.volume = volume;
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        {!afterSession && (
          <button
            onClick={onDone}
            className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium mb-10"
          >
            &lsaquo; Back
          </button>
        )}
        <h1 className="text-4xl font-semibold tracking-tight">
          {HYPNOSIS_TRACK.title}
        </h1>
        <div className="text-slate-500 text-base mt-2">{HYPNOSIS_TRACK.length}</div>
      </div>

      <p className="text-slate-100 text-lg leading-relaxed">
        {HYPNOSIS_TRACK.blurb}
      </p>

      <div className="bg-slate-900 border border-slate-700/70 rounded-2xl p-8">
        <audio
          ref={audioRef}
          src={HYPNOSIS_TRACK.url}
          preload="auto"
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onLoadedMetadata={(e) =>
            setDuration(e.currentTarget.duration || HYPNOSIS_TRACK.seconds)
          }
          onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        />
        <div className="flex items-center gap-6">
          {/* Drawn rather than typed. The glyph characters render as colour
              emoji on some platforms, which is where the odd-looking pause
              came from. */}
          <button
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="w-12 h-12 shrink-0 rounded-full deep-fill flex items-center justify-center text-white"
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="3" y="2" width="3.5" height="12" rx="1.1" />
                <rect x="9.5" y="2" width="3.5" height="12" rx="1.1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M4.5 2.6a1 1 0 0 1 1.52-.85l7 5.4a1 1 0 0 1 0 1.7l-7 5.4A1 1 0 0 1 4.5 13.4Z" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0 space-y-3">
            <div
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(elapsed)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrubTo(e.clientX, e.currentTarget);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  scrubTo(e.clientX, e.currentTarget);
                }
              }}
              onKeyDown={(e) => {
                const audio = audioRef.current;
                if (!audio) return;
                if (e.key === "ArrowRight") audio.currentTime += 10;
                if (e.key === "ArrowLeft") audio.currentTime -= 10;
              }}
              className="relative h-6 flex items-center cursor-pointer touch-none group"
            >
              <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${duration ? Math.round((elapsed / duration) * 1000) / 10 : 0}%`,
                    background: "hsl(from var(--ex) h s min(l, 58))",
                  }}
                />
              </div>
              <div
                className="absolute w-3.5 h-3.5 rounded-full border-2 border-slate-950 pointer-events-none"
                style={{
                  left: `${duration ? (elapsed / duration) * 100 : 0}%`,
                  transform: "translateX(-50%)",
                  background: "hsl(from var(--ex) h s min(l, 58))",
                }}
              />
            </div>
            <div className="flex justify-between text-slate-500 text-xs tabular-nums">
              <span>{fmt(elapsed)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
            {/* Arcs appear with the level: one quiet, two medium, three
                loud, none at zero. Same idea as a phone's volume icon, so
                the icon itself reads as a meter. */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-500 shrink-0"
              aria-hidden="true"
            >
              <path d="M10 5 5.5 9H2v6h3.5L10 19z" />
              {volume > 0 && <path d="M13.4 9.4a3.6 3.6 0 0 1 0 5.2" />}
              {volume > 0.34 && <path d="M16.4 6.8a7.3 7.3 0 0 1 0 10.4" />}
              {volume > 0.67 && <path d="M19.4 4.2a11 11 0 0 1 0 15.6" />}
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="w-full accent-current cursor-pointer"
            />
        </div>
      </div>

      {afterSession && (
        <button
          onClick={onDone}
          className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg py-5 text-xl font-medium"
        >
          Done
        </button>
      )}
    </div>
  );
}

function Motion3DExercise({ exercise, onFinish, onForceOverview, onStageChange, onLevelUp, onSessionEnd, onResetProgress, paused }) {
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
  // Scroll-wheel zoom factor, applied as a multiplier on the computed
  // camera distance. A ref (not state) so the wheel handler and the resize
  // handler can both read/write it without re-running the scene effect.
  const motZoomRef = useRef(1);
  const cubeHalfXRef = useRef(MOT_CUBE_HALF_X); // live current cube X half-extent — updated by onResize below (not just computed once at mount), so a screen that's wide from the start, or becomes wide later, actually gets a wider room instead of the room staying locked at whatever aspect ratio happened to be measured first

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

    const { clientWidth, clientHeight } = host;
    const width = Math.max(MOT_MIN_CANVAS_DIM, clientWidth || MOT_MIN_CANVAS_DIM);
    const height = Math.max(MOT_MIN_CANVAS_DIM, clientHeight || MOT_MIN_CANVAS_DIM);
    setCanvasSize({ w: width, h: height });

    // The room's actual width in world units, derived from the real
    // measured aspect ratio — MOT_CUBE_HALF * aspect is exactly the value
    // that makes the width-fit and height-fit camera distances equal (see
    // computeMotionCameraDistance below), i.e. no wasted margin on either
    // side. Math.max against the old fixed MOT_CUBE_HALF_X means a normal
    // or narrower window still gets exactly the room it had before —
    // this only widens things on screens wider than that original ratio,
    // which is exactly the "doesn't fill a wide screen" case being fixed.
    // Written into cubeHalfXRef (not just a local const) because onResize
    // below recomputes and rebuilds the boundary box from this same ref
    // every time the aspect ratio actually changes — the geometry stays in
    // sync with the live viewport instead of being frozen at whatever
    // width happened to be measured on this very first layout pass. Only
    // this X extent is ever touched; MOT_CUBE_HALF (the Y/Z extents that
    // drive vertical framing) is a fixed constant nothing here changes.
    cubeHalfXRef.current = motCubeHalfX(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(MOT_CAMERA_FOV, width / height, 0.1, 100);

    // A refused context throws here. Bailing out quietly beats taking the
    // whole app down: the exercise just doesn't paint and everything else
    // stays usable.
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return undefined;
    }
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
    const shadowExtent = cubeHalfXRef.current * 1.6;
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

    // Boundary box geometry is rebuilt by name (buildBoundary, defined just
    // below) so onResize can call the exact same construction again with a
    // new width later, instead of this being a one-off mount-only build.
    const buildBoundary = (halfX) => {
      const geo = new THREE.BoxGeometry(halfX * 2, MOT_CUBE_HALF * 2, MOT_CUBE_HALF * 2);
      // EdgesGeometry + LineSegments draws only the 12 real cube edges — a
      // plain wireframe material on the box mesh would also draw the
      // diagonal split of each face's two triangles, which reads as stray
      // lines slicing across the cube.
      const edges = new THREE.EdgesGeometry(geo);
      const mat = new THREE.LineBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.55,
      });
      const mesh = new THREE.LineSegments(edges, mat);
      return { geo, edges, mat, mesh };
    };
    let boundaryParts = buildBoundary(cubeHalfXRef.current);
    scene.add(boundaryParts.mesh);

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
      mesh.position.copy(motRandomPointInCube(MOT_BALL_RADIUS, cubeHalfXRef.current));
      const lines = ballLineTemplate.clone();
      mesh.add(lines);
      // Invisible, larger sphere used ONLY for click detection — a child
      // of the visible mesh, so it automatically tracks the ball's
      // position with zero extra code. Makes clicking noticeably more
      // forgiving than requiring the cursor to land on the ball's exact
      // (fairly small) visible pixels, without changing how raycasting
      // itself works — same proven mechanism, just a bigger target.
      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(MOT_BALL_RADIUS * 1.6, 12, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      mesh.add(hitMesh);
      scene.add(mesh);
      balls.push({
        id: i,
        letter: letters[i],
        mesh,
        hitMesh,
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

    const handleClick = (e) => {
      if (stageRef.current !== "select") return;
      const rect = renderer.domElement.getBoundingClientRect();
      ctx.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ctx.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ctx.raycaster.setFromCamera(ctx.mouse, ctx.camera);
      const hits = ctx.raycaster.intersectObjects(ctx.balls.map((b) => b.hitMesh));
      if (!hits.length) return;
      const ball = ctx.balls.find((b) => b.hitMesh === hits[0].object);
      if (!ball) return;
      toggleBallSelection(ball);
    };
    // Attached directly to the canvas itself rather than relying on
    // React's onClick on a parent div — the canvas element was inserted
    // imperatively (mount.appendChild(renderer.domElement) above), and a
    // native listener bound right where the actual pixels are is the most
    // direct, dependable way to guarantee clicks are caught, with no
    // dependency on how any wrapping element's event handling behaves.
    mount.addEventListener("click", handleClick);

    const onResize = () => {
      if (!host) return;
      const w = Math.max(MOT_MIN_CANVAS_DIM, host.clientWidth || MOT_MIN_CANVAS_DIM);
      const h = Math.max(MOT_MIN_CANVAS_DIM, host.clientHeight || MOT_MIN_CANVAS_DIM);
      renderer.setSize(w, h);
      camera.aspect = w / h;

      // Same formula as the initial mount computation above — recomputed
      // here so a screen that's wide from the very first layout pass (or
      // becomes wide later, e.g. a window resize or sidebar closing) gets
      // an actually wider room, not just a camera that pulls back to fit
      // more empty space around an unchanged, narrower box. Only ever
      // touches the X extent — MOT_CUBE_HALF (Y/Z, i.e. height) is a fixed
      // constant that nothing in this resize path reads or writes.
      const newHalfX = motCubeHalfX(w, h);
      if (Math.abs(newHalfX - cubeHalfXRef.current) > 0.01) {
        cubeHalfXRef.current = newHalfX;
        scene.remove(boundaryParts.mesh);
        boundaryParts.geo.dispose();
        boundaryParts.edges.dispose();
        boundaryParts.mat.dispose();
        boundaryParts = buildBoundary(newHalfX);
        scene.add(boundaryParts.mesh);
      }

      // Aspect ratio changing (window resize, orientation change, sidebar
      // opening/closing) changes what camera distance is actually required
      // to keep the cube fully framed — recomputed here every time rather
      // than left at whatever distance happened to be right for the
      // aspect ratio at mount, which is exactly how this ended up clipping
      // on some screen shapes but not others before.
      camera.position.set(
        0,
        0,
        computeMotionCameraDistance(w, h, MOT_CAMERA_FOV, cubeHalfXRef.current) *
          motZoomRef.current
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      setCanvasSize({ w, h });
    };
    // ResizeObserver instead of a plain window "resize" listener — this
    // fires whenever the HOST ELEMENT's own box changes size, which covers
    // an actual window resize but also things a window-resize listener
    // would miss entirely: other UI on the page pushing this box smaller,
    // orientation changes, or the box's final size simply not being known
    // yet on the very first layout pass.
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host);
    onResizeRef.current = onResize;

    // Dead-on, head-first view: the camera sits exactly on the box's centre
    // axis (x = 0, y = 0) looking straight down -Z at the middle of the room,
    // so the back wall is centred and the four side walls read as symmetric
    // trapezoids around it. The old (0.23, 0.02) offset put the vanishing
    // point off-centre and skewed the perspective.
    //
    // Z distance is computed, not guessed — see computeMotionCameraDistance
    // for the containment math — then scaled by the scroll-wheel zoom factor.
    // Recomputed on every resize too (see onResize above), so it stays
    // correct across aspect ratios instead of being tuned for one window shape.
    const applyCameraDistance = (w, h) => {
      const base = computeMotionCameraDistance(w, h, MOT_CAMERA_FOV, cubeHalfXRef.current);
      camera.position.set(0, 0, base * motZoomRef.current);
      camera.lookAt(0, 0, 0);
    };
    applyCameraDistance(width, height);

    // Scroll to zoom. Multiplicative so each notch feels the same at any
    // distance, clamped so the camera can neither end up inside the box nor
    // pull so far back the room becomes a speck. Non-passive because it has
    // to preventDefault — otherwise the wheel scrolls the page instead.
    const handleWheel = (e) => {
      e.preventDefault();
      const next = motZoomRef.current * Math.exp(e.deltaY * 0.0012);
      motZoomRef.current = Math.min(MOT_ZOOM_MAX, Math.max(MOT_ZOOM_MIN, next));
      const w = Math.max(MOT_MIN_CANVAS_DIM, host.clientWidth || MOT_MIN_CANVAS_DIM);
      const h = Math.max(MOT_MIN_CANVAS_DIM, host.clientHeight || MOT_MIN_CANVAS_DIM);
      applyCameraDistance(w, h);
    };
    mount.addEventListener("wheel", handleWheel, { passive: false });

    const animate = () => {
      ctx.animFrame = requestAnimationFrame(animate);
      const dt = Math.min(ctx.clock.getDelta(), 0.05);

      if (stageRef.current === "track" && !pausedRef.current) {
        const speedNow = motDisplaySpeedToVelocity(speedRef.current);
        const bound = MOT_CUBE_HALF - MOT_BALL_RADIUS;
        const boundX = cubeHalfXRef.current - MOT_BALL_RADIUS;
        ctx.balls.forEach((b) => {
          b.mesh.position.addScaledVector(b.vel, speedNow * dt);
          const p = b.mesh.position;
          // Axis-aligned reflection off each of the cube's 6 walls —
          // independent per axis, unlike the sphere's single radial check.
          // X uses its own wider bound since the box is stretched
          // left/right relative to the other two axes.
          ["x", "y", "z"].forEach((axis) => {
            const axisBound = axis === "x" ? boundX : bound;
            if (p[axis] > axisBound) {
              p[axis] = axisBound;
              b.vel[axis] = -Math.abs(b.vel[axis]);
            } else if (p[axis] < -axisBound) {
              p[axis] = -axisBound;
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
      mount.removeEventListener("click", handleClick);
      mount.removeEventListener("wheel", handleWheel);
      resizeObserver.disconnect();
      cancelAnimationFrame(ctx.animFrame);
      ballGeo.dispose();
      ballLineTemplate.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      boundaryParts.geo.dispose();
      boundaryParts.edges.dispose();
      boundaryParts.mat.dispose();
      balls.forEach((b) => b.mesh.material.dispose());
      // dispose() frees Three's own GPU objects but leaves the WebGL
      // context itself alive. Browsers cap how many live contexts a page
      // may hold (~16 in Chrome), so leaving and re-entering 3D MOT enough
      // times exhausted the pool and the next mount threw "Error creating
      // WebGL context", which took the whole app to the error boundary.
      // forceContextLoss() hands the context back, and dropping the canvas
      // out of the DOM lets it be collected.
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        // Not implemented on every backend; the dispose above still stands.
      }
      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
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
      onLevelUp?.(nextTier, nextSpeedValue, `3D MOT speed ${nextSpeedValue.toFixed(2)}`);
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
        className="fixed inset-0 bg-slate-950 overflow-hidden"
        style={{
          cursor: stage === "select" ? "pointer" : "default",
        }}
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
              WebkitTextStroke: "1.5px rgba(8,9,10,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              display: "none",
            }}
          >
            {letter}
          </div>
        ))}

        <div
          className="absolute top-1/2 left-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full bg-slate-200/80 pointer-events-none"
          style={{ boxShadow: "0 0 6px 2px rgba(247,248,248,0.35)" }}
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
            // Straight to Overview, not just "whatever's next" — this is
            // simulating the whole session ending, so it should land where
            // a real 15-minute cutoff eventually would even if motion3d
            // isn't the last step in the current regime.
            (onForceOverview || onFinish)?.();
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
      <div className="text-slate-100 text-lg font-semibold uppercase tracking-wide">
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
