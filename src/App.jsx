
import { useState, useMemo } from "react";
import ReactDOM from "react-dom/client";

const AWARENESS_STAGES = ["Unaware", "Problem Aware", "Solution Aware", "Product Aware", "Most Aware"];
const FORMATS = ["Video", "Static", "UGC", "Carousel", "Story/Reel", "Long-form"];
const STATUSES = ["Planned", "In Briefing", "Live", "Paused", "Winner", "Killed"];
const EMOJI_OPTIONS = ["🎯","🔥","🎁","🏠","🔪","🎨","⏳","💡","🚀","💎","🧠","❤️","🌿","⚡","🛒"];
const COLOR_OPTIONS = ["#E8F4FD","#FEF3E8","#E8F8EF","#F3E8FE","#FEE8E8","#FFF8E1","#E8F5E9","#FCE4EC","#E3F2FD","#F3E5F5"];

const STATUS_COLORS = {
  Planned: "bg-gray-100 text-gray-600",
  "In Briefing": "bg-yellow-100 text-yellow-700",
  Live: "bg-blue-100 text-blue-700",
  Paused: "bg-orange-100 text-orange-700",
  Winner: "bg-green-100 text-green-700",
  Killed: "bg-red-100 text-red-600",
};
const AWARENESS_COLORS = {
  Unaware: "bg-purple-100 text-purple-700",
  "Problem Aware": "bg-pink-100 text-pink-700",
  "Solution Aware": "bg-blue-100 text-blue-700",
  "Product Aware": "bg-teal-100 text-teal-700",
  "Most Aware": "bg-green-100 text-green-700",
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const TABS = ["Test Tracker", "Brief Builder", "Angle Library", "Persona Library"];
const ONBOARDING_STEPS = ["brand", "input", "personas", "angles", "done"];

// ── API helpers ──────────────────────────────────────────────────────────────
async function callClaude(prompt, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(b => b.text || "").join("") || "";
}

async function extractPersonasAndAngles(researchText, brandName, apiKey) {
  const prompt = `You are a senior DTC marketing strategist. Analyse the following brand research document and extract structured persona and angle data.

Brand: ${brandName}
Research:
${researchText.slice(0, 8000)}

Return ONLY a JSON object (no markdown, no backticks):
{
  "personas": [
    { "name": "Persona name", "emoji": "single emoji", "description": "1-2 sentence description of this persona" }
  ],
  "angles": [
    { "personaName": "must match a persona name above exactly", "name": "Angle name", "hook": "emotional hook / short description" }
  ]
}

Extract 3-6 personas and 2-4 angles per persona. Base everything strictly on the research provided.`;
  const text = await callClaude(prompt, apiKey);
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function generateBrief({ persona, angle, format, awareness, notes, brandContext, apiKey }) {
  const prompt = `You are a senior DTC creative strategist. Generate a concise creative brief for a paid social ad.

Brand context: ${brandContext}
Persona: ${persona.name} — ${persona.description || ""}
Angle: ${angle.name}
Emotional Hook: ${angle.hook}
Creative Format: ${format}
Stage of Awareness: ${awareness}
Additional Notes: ${notes || "None"}

Return ONLY a JSON object (no markdown, no backticks):
{
  "hooks": ["hook 1", "hook 2", "hook 3"],
  "shortCopy": "2-3 sentence ad body copy",
  "longCopy": "5-7 sentence longer ad body copy",
  "creativeDirection": "2-3 sentences on visual style, pacing, tone",
  "visualConcepts": ["concept 1", "concept 2", "concept 3"],
  "awarenessRationale": "1-2 sentences explaining why this awareness stage fits",
  "ctas": ["CTA 1", "CTA 2", "CTA 3"]
}`;
  const text = await callClaude(prompt, apiKey);
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Small reusable UI ────────────────────────────────────────────────────────
const Pill = ({ label, colorClass }) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>;

const Btn = ({ onClick, children, variant = "primary", disabled, className = "" }) => {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "border border-gray-200 text-gray-600 hover:bg-gray-50",
    ghost: "text-indigo-500 hover:underline",
    danger: "text-red-400 hover:underline",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, className = "" }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${className}`} />
);

const SelectEl = ({ value, onChange, options, className = "" }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    className={`border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 ${className}`}>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const Modal = ({ show, onClose, title, children, wide }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl w-full my-6 ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const Spinner = () => (
  <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto" />
);

// ── Brief display ────────────────────────────────────────────────────────────
const BriefDisplay = ({ brief }) => {
  if (!brief) return null;
  const Section = ({ title, children }) => (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">{title}</p>
      {children}
    </div>
  );
  return (
    <div className="space-y-5">
      <Section title="Hook Options">
        {brief.hooks?.map((h, i) => <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-800">"{h}"</div>)}
      </Section>
      <Section title="Short Copy">
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{brief.shortCopy}</div>
      </Section>
      <Section title="Long Copy">
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{brief.longCopy}</div>
      </Section>
      <Section title="Creative Direction">
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">{brief.creativeDirection}</div>
      </Section>
      <Section title="Visual Concepts">
        <ul className="space-y-1">{brief.visualConcepts?.map((v, i) => <li key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-indigo-400 font-bold">→</span>{v}</li>)}</ul>
      </Section>
      <Section title="Awareness Stage Rationale">
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">{brief.awarenessRationale}</div>
      </Section>
      <Section title="CTA Options">
        <div className="flex flex-wrap gap-2">{brief.ctas?.map((c, i) => <span key={i} className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-200">{c}</span>)}</div>
      </Section>
    </div>
  );
};

// ── Onboarding wizard ────────────────────────────────────────────────────────
function OnboardingWizard({ onComplete, apiKey }) {
  const [step, setStep] = useState(0); // 0=brand,1=input,2=personas,3=angles,4=done
  const [brandName, setBrandName] = useState("");
  const [brandContext, setBrandContext] = useState("");
  const [inputMethod, setInputMethod] = useState("paste"); // paste | pdf | manual
  const [researchText, setResearchText] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [personas, setPersonas] = useState([]);
  const [angles, setAngles] = useState([]);
  // new persona/angle forms
  const [newP, setNewP] = useState({ name: "", emoji: "🎯", color: "#E8F4FD", description: "" });
  const [newA, setNewA] = useState({ personaName: "", name: "", hook: "" });

  const handlePDF = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfLoading(true);
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let text = "";
      // basic text extraction from PDF bytes (looks for text between stream markers)
      const str = new TextDecoder("latin1").decode(bytes);
      const parts = str.match(/BT[\s\S]*?ET/g) || [];
      parts.forEach(p => { const t = p.match(/\(([^)]+)\)/g); if (t) text += t.map(x => x.slice(1,-1)).join(" ") + " "; });
      if (!text.trim()) text = str.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").slice(0, 10000);
      setResearchText(text.trim() || "Could not extract text from PDF. Please paste your research manually.");
      setInputMethod("paste");
    } catch {
      setResearchText("Could not read PDF. Please paste your research manually.");
      setInputMethod("paste");
    }
    setPdfLoading(false);
  };

  const handleExtract = async () => {
    if (!researchText.trim()) { setExtractError("Please paste your research text first."); return; }
    if (!apiKey) { setExtractError("Please enter your Anthropic API key at the top of the page."); return; }
    setExtracting(true); setExtractError("");
    try {
      const data = await extractPersonasAndAngles(researchText, brandName, apiKey);
      const colorMap = {};
      const ps = (data.personas || []).map((p, i) => {
        const id = uid();
        colorMap[p.name] = id;
        return { id, name: p.name, emoji: p.emoji || EMOJI_OPTIONS[i % EMOJI_OPTIONS.length], color: COLOR_OPTIONS[i % COLOR_OPTIONS.length], description: p.description || "" };
      });
      const as = (data.angles || []).map(a => {
        const persona = ps.find(p => p.name === a.personaName) || ps[0];
        return { id: uid(), personaId: persona?.id, name: a.name, hook: a.hook };
      });
      setPersonas(ps); setAngles(as);
      setStep(2);
    } catch (e) {
      setExtractError("Extraction failed: " + e.message + ". Try again or add personas manually.");
    }
    setExtracting(false);
  };

  const addPersona = () => {
    if (!newP.name.trim()) return;
    setPersonas(p => [...p, { ...newP, id: uid() }]);
    setNewP({ name: "", emoji: "🎯", color: "#E8F4FD", description: "" });
  };
  const removePersona = id => { setPersonas(p => p.filter(x => x.id !== id)); setAngles(a => a.filter(x => x.personaId !== id)); };

  const addAngle = () => {
    if (!newA.name.trim() || !newA.personaName) return;
    const persona = personas.find(p => p.name === newA.personaName);
    if (!persona) return;
    setAngles(a => [...a, { id: uid(), personaId: persona.id, name: newA.name, hook: newA.hook }]);
    setNewA({ personaName: newA.personaName, name: "", hook: "" });
  };
  const removeAngle = id => setAngles(a => a.filter(x => x.id !== id));

  const finish = () => {
    onComplete({ brandName, brandContext, personas, angles });
  };

  const stepLabels = ["Brand", "Research", "Personas", "Angles", "Done"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        {/* Progress */}
        <div className="bg-indigo-600 px-6 py-4">
          <h1 className="text-white font-bold text-lg mb-3">Set Up New Client</h1>
          <div className="flex gap-2">
            {stepLabels.map((l, i) => (
              <div key={l} className="flex-1 text-center">
                <div className={`h-1.5 rounded-full mb-1 ${i <= step ? "bg-white" : "bg-indigo-400"}`} />
                <span className={`text-xs ${i <= step ? "text-white" : "text-indigo-300"}`}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* STEP 0 — Brand */}
          {step === 0 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900">What's the brand?</h2>
                <p className="text-sm text-gray-500 mt-1">Start with the basics — you can edit everything later.</p>
              </div>
              <Field label="Brand Name">
                <Input value={brandName} onChange={setBrandName} placeholder="e.g. Katto Knives" />
              </Field>
              <Field label="Brand Context">
                <textarea value={brandContext} onChange={e => setBrandContext(e.target.value)} rows={4}
                  placeholder="Describe the brand in a few sentences — positioning, USPs, tone of voice, target market. This feeds into every AI-generated brief."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              </Field>
              <Btn onClick={() => { if (brandName.trim()) setStep(1); }} disabled={!brandName.trim()} className="w-full justify-center">Continue →</Btn>
            </>
          )}

          {/* STEP 1 — Research input */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add your research</h2>
                <p className="text-sm text-gray-500 mt-1">The AI will extract personas and angles automatically — or skip to add them manually.</p>
              </div>
              <div className="flex gap-2">
                {["paste","pdf","manual"].map(m => (
                  <button key={m} onClick={() => setInputMethod(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${inputMethod === m ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {m === "paste" ? "📋 Paste Research" : m === "pdf" ? "📄 Upload PDF" : "✏️ Manual"}
                  </button>
                ))}
              </div>

              {inputMethod === "paste" && (
                <Field label="Paste research / review mining / strategy doc">
                  <textarea value={researchText} onChange={e => setResearchText(e.target.value)} rows={8}
                    placeholder="Paste your brand research, review mining, persona notes, competitor analysis — anything relevant..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none font-mono" />
                </Field>
              )}

              {inputMethod === "pdf" && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center space-y-3">
                  {pdfLoading ? <><Spinner /><p className="text-sm text-gray-400">Reading PDF...</p></> : (
                    <>
                      <p className="text-3xl">📄</p>
                      <p className="text-sm text-gray-600">Upload your brand brief or research PDF</p>
                      <label className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition inline-block">
                        Choose PDF <input type="file" accept=".pdf" onChange={handlePDF} className="hidden" />
                      </label>
                      {researchText && <p className="text-xs text-green-600 font-medium">✓ Text extracted — switching to paste view to review</p>}
                    </>
                  )}
                </div>
              )}

              {inputMethod === "manual" && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700">
                  You'll add personas and angles manually in the next two steps. You can always come back and add research later from the Persona Library tab.
                </div>
              )}

              {extractError && <p className="text-sm text-red-500">{extractError}</p>}

              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep(0)}>← Back</Btn>
                {inputMethod === "manual"
                  ? <Btn onClick={() => setStep(2)} className="flex-1 justify-center">Continue →</Btn>
                  : <Btn onClick={handleExtract} disabled={extracting || !researchText.trim()} className="flex-1 justify-center">
                      {extracting ? "Extracting personas..." : "✦ Extract Personas & Angles →"}
                    </Btn>
                }
              </div>
            </>
          )}

          {/* STEP 2 — Personas */}
          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review personas</h2>
                <p className="text-sm text-gray-500 mt-1">Edit, remove, or add personas for {brandName}.</p>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {personas.length === 0 && <p className="text-sm text-gray-400 italic">No personas yet — add one below.</p>}
                {personas.map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: p.color }}>{p.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                    </div>
                    <button onClick={() => removePersona(p.id)} className="text-red-400 text-xs hover:underline flex-shrink-0">Remove</button>
                  </div>
                ))}
              </div>
              <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Add persona</p>
                <Input value={newP.name} onChange={v => setNewP(p => ({ ...p, name: v }))} placeholder="Persona name" />
                <Input value={newP.description} onChange={v => setNewP(p => ({ ...p, description: v }))} placeholder="Short description" />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Emoji</p>
                    <div className="flex flex-wrap gap-1">{EMOJI_OPTIONS.map(e => <button key={e} onClick={() => setNewP(p => ({ ...p, emoji: e }))} className={`text-lg p-1 rounded ${newP.emoji === e ? "bg-indigo-100" : "hover:bg-gray-100"}`}>{e}</button>)}</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Colour</p>
                    <div className="flex flex-wrap gap-1">{COLOR_OPTIONS.map(c => <button key={c} onClick={() => setNewP(p => ({ ...p, color: c }))} className={`w-7 h-7 rounded-lg border-2 ${newP.color === c ? "border-indigo-500" : "border-transparent"}`} style={{ background: c }} />)}</div>
                  </div>
                </div>
                <Btn onClick={addPersona} disabled={!newP.name.trim()} variant="secondary" className="w-full justify-center">+ Add Persona</Btn>
              </div>
              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep(1)}>← Back</Btn>
                <Btn onClick={() => setStep(3)} disabled={personas.length === 0} className="flex-1 justify-center">Continue →</Btn>
              </div>
            </>
          )}

          {/* STEP 3 — Angles */}
          {step === 3 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review angles</h2>
                <p className="text-sm text-gray-500 mt-1">These are the creative angles you'll test. Each belongs to a persona.</p>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {angles.length === 0 && <p className="text-sm text-gray-400 italic">No angles yet — add one below.</p>}
                {angles.map(a => {
                  const persona = personas.find(p => p.id === a.personaId);
                  return (
                    <div key={a.id} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2">
                      {persona && <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0 mt-0.5" style={{ background: persona.color }}>{persona.emoji}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.hook}</p>
                      </div>
                      <button onClick={() => removeAngle(a.id)} className="text-red-400 text-xs hover:underline flex-shrink-0">Remove</button>
                    </div>
                  );
                })}
              </div>
              <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Add angle</p>
                <Field label="Persona">
                  <SelectEl value={newA.personaName} onChange={v => setNewA(a => ({ ...a, personaName: v }))} options={["Select persona...", ...personas.map(p => p.name)]} className="w-full" />
                </Field>
                <Input value={newA.name} onChange={v => setNewA(a => ({ ...a, name: v }))} placeholder="Angle name (e.g. The Gift That Lasts)" />
                <Input value={newA.hook} onChange={v => setNewA(a => ({ ...a, hook: v }))} placeholder="Emotional hook (e.g. Heirloom emotion + personalisation)" />
                <Btn onClick={addAngle} disabled={!newA.name.trim() || !newA.personaName || newA.personaName === "Select persona..."} variant="secondary" className="w-full justify-center">+ Add Angle</Btn>
              </div>
              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep(2)}>← Back</Btn>
                <Btn onClick={finish} className="flex-1 justify-center">✓ Create Client →</Btn>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState("Test Tracker");
  const [filters, setFilters] = useState({ persona: "All", awareness: "All", format: "All", status: "All" });

  // modals
  const [showTestModal, setShowTestModal] = useState(false);
  const [showAngleModal, setShowAngleModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [briefModalTest, setBriefModalTest] = useState(null);
  const [editingTest, setEditingTest] = useState(null);
  const [editingAngle, setEditingAngle] = useState(null);
  const [editingPersona, setEditingPersona] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);

  // brief builder
  const [bbPersonaId, setBbPersonaId] = useState(null);
  const [bbAngleId, setBbAngleId] = useState(null);
  const [bbFormat, setBbFormat] = useState("Video");
  const [bbAwareness, setBbAwareness] = useState("Problem Aware");
  const [bbNotes, setBbNotes] = useState("");
  const [bbBrief, setBbBrief] = useState(null);
  const [bbLoading, setBbLoading] = useState(false);

  const client = clients.find(c => c.id === activeClientId) || null;
  const personas = client?.personas || [];
  const angles = client?.angles || [];
  const tests = client?.tests || [];

  const updateClient = (patch) => setClients(cs => cs.map(c => c.id === activeClientId ? { ...c, ...patch } : c));
  const updatePersonas = (fn) => updateClient({ personas: fn(personas) });
  const updateAngles = (fn) => updateClient({ angles: fn(angles) });
  const updateTests = (fn) => updateClient({ tests: fn(tests) });

  const getPersona = id => personas.find(p => p.id === id);
  const getAngle = id => angles.find(a => a.id === id);

  const handleOnboardingComplete = ({ brandName, brandContext, personas: ps, angles: as }) => {
    const newClient = { id: uid(), brandName, brandContext, personas: ps, angles: as, tests: [] };
    setClients(cs => [...cs, newClient]);
    setActiveClientId(newClient.id);
    setShowOnboarding(false);
    setActiveTab("Test Tracker");
    if (ps.length > 0) { setBbPersonaId(ps[0].id); setBbAngleId(as.find(a => a.personaId === ps[0].id)?.id || null); }
  };

  const filteredTests = useMemo(() => {
    return tests.filter(t => {
      const angle = getAngle(t.angleId);
      const persona = angle ? getPersona(angle.personaId) : null;
      if (filters.persona !== "All" && (!persona || persona.name !== filters.persona)) return false;
      if (filters.awareness !== "All" && t.awareness !== filters.awareness) return false;
      if (filters.format !== "All" && t.format !== filters.format) return false;
      if (filters.status !== "All" && t.status !== filters.status) return false;
      return true;
    });
  }, [tests, filters, angles, personas]);

  const handleGenerateBrief = async (test) => {
    if (!apiKey) { alert("Please enter your Anthropic API key at the top."); return; }
    const angle = getAngle(test.angleId);
    const persona = getPersona(angle?.personaId);
    if (!angle || !persona) return;
    setGeneratingId(test.id);
    try {
      const brief = await generateBrief({ persona, angle, format: test.format, awareness: test.awareness, notes: test.notes, brandContext: client?.brandContext || "", apiKey });
      const updated = { ...test, brief };
      updateTests(ts => ts.map(t => t.id === test.id ? updated : t));
      setBriefModalTest(updated);
      setShowBriefModal(true);
    } catch (e) { alert("Brief generation failed: " + e.message); }
    setGeneratingId(null);
  };

  const handleBBGenerate = async () => {
    if (!apiKey) { alert("Please enter your Anthropic API key at the top."); return; }
    const angle = getAngle(bbAngleId);
    const persona = getPersona(bbPersonaId);
    if (!angle || !persona) return;
    setBbLoading(true); setBbBrief(null);
    try {
      const brief = await generateBrief({ persona, angle, format: bbFormat, awareness: bbAwareness, notes: bbNotes, brandContext: client?.brandContext || "", apiKey });
      setBbBrief(brief);
    } catch (e) { alert("Brief generation failed: " + e.message); }
    setBbLoading(false);
  };

  const cycleStatus = id => updateTests(ts => ts.map(t => {
    if (t.id !== id) return t;
    return { ...t, status: STATUSES[(STATUSES.indexOf(t.status) + 1) % STATUSES.length] };
  }));

  const exportCSV = () => {
    const rows = [["Test Name", "Angle", "Persona", "Format", "Awareness Stage", "Status", "Notes"]];
    tests.forEach(t => {
      const angle = getAngle(t.angleId); const persona = angle ? getPersona(angle.personaId) : null;
      rows.push([t.name, angle?.name || "", persona?.name || "", t.format, t.awareness, t.status, t.notes]);
    });
    const csv = rows.map(r => r.map(c => `"${(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${client?.brandName || "tracker"}-tests.csv`; a.click();
  };

  const bbAngles = angles.filter(a => a.personaId === bbPersonaId);

  // No clients yet
  if (clients.length === 0 && !showOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-4xl mx-auto shadow-lg">🎯</div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Creative Test Tracker</h1>
            <p className="text-gray-500 mt-2">Agency framework for managing personas, angles, awareness stages and AI-generated creative briefs.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-left space-y-2">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Anthropic API Key</p>
            <div className="flex gap-2">
              <input type={showApiKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={() => setShowApiKey(s => !s)} className="text-xs text-gray-400 hover:text-gray-600 px-2">{showApiKey ? "Hide" : "Show"}</button>
            </div>
            <p className="text-xs text-gray-400">Required for AI brief generation. Get yours at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-indigo-500 underline">console.anthropic.com</a></p>
          </div>
          <button onClick={() => setShowOnboarding(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition text-lg">+ Add Your First Client</button>
        </div>
      </div>
    );
  }

  if (showOnboarding) return <OnboardingWizard onComplete={handleOnboardingComplete} apiKey={apiKey} />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg font-bold text-gray-900 flex-shrink-0">🎯 Creative Tracker</span>
            {/* Client selector */}
            <div className="flex items-center gap-2 flex-wrap">
              {clients.map(c => (
                <button key={c.id} onClick={() => { setActiveClientId(c.id); setFilters({ persona: "All", awareness: "All", format: "All", status: "All" }); setBbBrief(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${c.id === activeClientId ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {c.brandName}
                </button>
              ))}
              <button onClick={() => setShowOnboarding(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-indigo-600 hover:bg-indigo-50 transition">+ Client</button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <input type={showApiKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-... (API Key)" className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={() => setShowApiKey(s => !s)} className="text-xs text-gray-400 hover:text-gray-600">{showApiKey ? "Hide" : "Show"}</button>
            {apiKey && <span className="text-xs text-green-600 font-semibold">✓</span>}
            <Btn onClick={exportCSV} variant="secondary" className="text-xs px-3 py-1.5">↓ CSV</Btn>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-4 gap-3">
        {[
          ["Tests", tests.length, "text-gray-700"],
          ["Live", tests.filter(t=>t.status==="Live").length, "text-blue-600"],
          ["Winners", tests.filter(t=>t.status==="Winner").length, "text-green-600"],
          ["Briefs", tests.filter(t=>t.brief).length, "text-indigo-600"],
        ].map(([l,v,c]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{l}</p>
            <p className={`text-2xl font-bold mt-0.5 ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Brand context */}
      {client && (
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 flex items-start gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mt-1 flex-shrink-0">Brand</span>
            <textarea value={client.brandContext} onChange={e => updateClient({ brandContext: e.target.value })} rows={2}
              className="flex-1 text-sm text-gray-700 focus:outline-none resize-none bg-transparent" placeholder="Brand context for AI brief generation..." />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-1">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{tab}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">

        {/* TEST TRACKER */}
        {activeTab === "Test Tracker" && (
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-500 font-medium">Filter:</span>
              <SelectEl value={filters.persona} onChange={v => setFilters(f=>({...f,persona:v}))} options={["All",...personas.map(p=>p.name)]} />
              <SelectEl value={filters.awareness} onChange={v => setFilters(f=>({...f,awareness:v}))} options={["All",...AWARENESS_STAGES]} />
              <SelectEl value={filters.format} onChange={v => setFilters(f=>({...f,format:v}))} options={["All",...FORMATS]} />
              <SelectEl value={filters.status} onChange={v => setFilters(f=>({...f,status:v}))} options={["All",...STATUSES]} />
              <button onClick={() => setFilters({persona:"All",awareness:"All",format:"All",status:"All"})} className="text-xs text-indigo-500 hover:underline">Clear</button>
              <button onClick={() => { setEditingTest({id:null,angleId:angles[0]?.id||null,name:"",format:"Video",awareness:"Problem Aware",status:"Planned",notes:"",brief:null}); setShowTestModal(true); }}
                className="ml-auto bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add Test</button>
            </div>
            {filteredTests.length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">No tests match these filters.</div>}
            {filteredTests.map(test => {
              const angle = getAngle(test.angleId); const persona = angle ? getPersona(angle.personaId) : null;
              const isGen = generatingId === test.id;
              return (
                <div key={test.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 hover:border-indigo-200 transition">
                  {persona && <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:persona.color}}>{persona.emoji}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{test.name}</p>
                        {angle && <p className="text-xs text-gray-400">Angle: {angle.name}</p>}
                        {persona && <p className="text-xs text-gray-400">Persona: {persona.name}</p>}
                      </div>
                      <button onClick={() => cycleStatus(test.id)} className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer flex-shrink-0 ${STATUS_COLORS[test.status]}`}>{test.status}</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Pill label={test.format} colorClass="bg-gray-100 text-gray-600" />
                      <Pill label={test.awareness} colorClass={AWARENESS_COLORS[test.awareness]||"bg-gray-100 text-gray-600"} />
                      {test.brief && <Pill label="✓ Brief" colorClass="bg-indigo-50 text-indigo-600" />}
                    </div>
                    {test.notes && <p className="text-xs text-gray-400 mt-1.5 italic">{test.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    {test.brief
                      ? <button onClick={() => { setBriefModalTest(test); setShowBriefModal(true); }} className="text-xs text-indigo-600 font-semibold hover:underline">View Brief</button>
                      : <button onClick={() => handleGenerateBrief(test)} disabled={isGen} className={`text-xs px-2 py-1 rounded-lg font-semibold ${isGen?"bg-gray-100 text-gray-400":"bg-indigo-600 text-white hover:bg-indigo-700"}`}>{isGen?"Generating...":"✦ Brief"}</button>
                    }
                    <button onClick={() => { setEditingTest({...test}); setShowTestModal(true); }} className="text-xs text-gray-400 hover:text-indigo-500">Edit</button>
                    <button onClick={() => updateTests(ts=>ts.filter(t=>t.id!==test.id))} className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BRIEF BUILDER */}
        {activeTab === "Brief Builder" && (
          <div className="grid gap-4" style={{gridTemplateColumns: bbBrief ? "1fr 1.4fr" : "1fr"}}>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 self-start">
              <p className="font-semibold text-gray-800">Build a Brief</p>
              <Field label="Persona">
                <select value={bbPersonaId||""} onChange={e=>{setBbPersonaId(e.target.value);setBbAngleId(angles.find(a=>a.personaId===e.target.value)?.id||null);setBbBrief(null);}}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">Select persona...</option>
                  {personas.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              </Field>
              <Field label="Angle">
                <select value={bbAngleId||""} onChange={e=>{setBbAngleId(e.target.value);setBbBrief(null);}}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">Select angle...</option>
                  {bbAngles.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {bbAngleId && <p className="text-xs text-gray-400 mt-1 italic">{getAngle(bbAngleId)?.hook}</p>}
              </Field>
              <Field label="Format"><SelectEl value={bbFormat} onChange={v=>{setBbFormat(v);setBbBrief(null);}} options={FORMATS} className="w-full"/></Field>
              <Field label="Stage of Awareness"><SelectEl value={bbAwareness} onChange={v=>{setBbAwareness(v);setBbBrief(null);}} options={AWARENESS_STAGES} className="w-full"/></Field>
              <Field label="Extra Notes">
                <textarea value={bbNotes} onChange={e=>setBbNotes(e.target.value)} rows={3} placeholder="Seasonal context, offer details, tone notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"/>
              </Field>
              <button onClick={handleBBGenerate} disabled={bbLoading||!bbAngleId||!bbPersonaId}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${bbLoading||!bbAngleId||!bbPersonaId?"bg-gray-100 text-gray-400 cursor-not-allowed":"bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                {bbLoading?"✦ Generating...":"✦ Generate Brief"}
              </button>
              {bbBrief && (
                <button onClick={() => {
                  const t={id:uid(),angleId:bbAngleId,name:`${getAngle(bbAngleId)?.name} — ${bbFormat}`,format:bbFormat,awareness:bbAwareness,status:"In Briefing",notes:bbNotes,brief:bbBrief};
                  updateTests(ts=>[...ts,t]); alert("Saved to Test Tracker.");
                }} className="w-full py-2 rounded-xl text-sm font-semibold border border-indigo-300 text-indigo-600 hover:bg-indigo-50">+ Save as Test</button>
              )}
            </div>
            {bbLoading && <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-center" style={{minHeight:300}}><div className="text-center space-y-3"><Spinner/><p className="text-sm text-gray-400">Building your brief...</p></div></div>}
            {bbBrief && !bbLoading && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">Generated Brief</p>
                  <div className="flex gap-2"><Pill label={bbFormat} colorClass="bg-gray-100 text-gray-600"/><Pill label={bbAwareness} colorClass={AWARENESS_COLORS[bbAwareness]||"bg-gray-100 text-gray-600"}/></div>
                </div>
                <BriefDisplay brief={bbBrief}/>
              </div>
            )}
          </div>
        )}

        {/* ANGLE LIBRARY */}
        {activeTab === "Angle Library" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Btn onClick={() => { setEditingAngle({id:null,personaId:personas[0]?.id||null,name:"",hook:""}); setShowAngleModal(true); }}>+ Add Angle</Btn>
            </div>
            {personas.map(persona => {
              const pas = angles.filter(a=>a.personaId===persona.id);
              if (!pas.length) return null;
              return (
                <div key={persona.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3" style={{background:persona.color}}>
                    <span className="text-2xl">{persona.emoji}</span>
                    <span className="font-semibold text-gray-800 text-sm">{persona.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">{pas.length} angles</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {pas.map(angle => {
                      const tc = tests.filter(t=>t.angleId===angle.id).length;
                      return (
                        <div key={angle.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{angle.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{angle.hook}</p>
                          </div>
                          <span className="text-xs text-gray-400">{tc} test{tc!==1?"s":""}</span>
                          <button onClick={() => { setEditingAngle({...angle}); setShowAngleModal(true); }} className="text-xs text-indigo-500 hover:underline">Edit</button>
                          <button onClick={() => updateAngles(as=>as.filter(a=>a.id!==angle.id))} className="text-xs text-red-400 hover:underline">Delete</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PERSONA LIBRARY */}
        {activeTab === "Persona Library" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Btn onClick={() => { setEditingPersona({id:null,name:"",emoji:"🎯",color:"#E8F4FD",description:""}); setShowPersonaModal(true); }}>+ Add Persona</Btn>
            </div>
            {personas.map(persona => {
              const ac = angles.filter(a=>a.personaId===persona.id).length;
              const tc = tests.filter(t=>angles.find(a=>a.id===t.angleId)?.personaId===persona.id).length;
              return (
                <div key={persona.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{background:persona.color}}>{persona.emoji}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{persona.name}</p>
                    {persona.description && <p className="text-xs text-gray-400 mt-0.5">{persona.description}</p>}
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-gray-400">{ac} angle{ac!==1?"s":""}</span>
                      <span className="text-xs text-gray-400">{tc} test{tc!==1?"s":""}</span>
                    </div>
                  </div>
                  <button onClick={() => { setEditingPersona({...persona}); setShowPersonaModal(true); }} className="text-xs text-indigo-500 hover:underline">Edit</button>
                  <button onClick={() => { updatePersonas(ps=>ps.filter(p=>p.id!==persona.id)); updateAngles(as=>as.filter(a=>a.personaId!==persona.id)); }} className="text-xs text-red-400 hover:underline">Delete</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BRIEF MODAL */}
      <Modal show={showBriefModal} onClose={() => setShowBriefModal(false)} title={briefModalTest?.name||"Brief"} wide>
        {briefModalTest && (() => {
          const angle=getAngle(briefModalTest.angleId); const persona=angle?getPersona(angle.personaId):null;
          return <>
            <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
              {persona && <Pill label={`${persona.emoji} ${persona.name}`} colorClass="bg-gray-100 text-gray-600"/>}
              {angle && <Pill label={angle.name} colorClass="bg-indigo-50 text-indigo-600"/>}
              <Pill label={briefModalTest.format} colorClass="bg-gray-100 text-gray-600"/>
              <Pill label={briefModalTest.awareness} colorClass={AWARENESS_COLORS[briefModalTest.awareness]||"bg-gray-100 text-gray-600"}/>
            </div>
            <BriefDisplay brief={briefModalTest.brief}/>
            <button onClick={() => { handleGenerateBrief(briefModalTest); setShowBriefModal(false); }} className="w-full py-2 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 mt-2">↺ Regenerate</button>
          </>;
        })()}
      </Modal>

      {/* TEST MODAL */}
      <Modal show={showTestModal} onClose={() => setShowTestModal(false)} title={editingTest?.id?"Edit Test":"Add Test"}>
        {editingTest && <>
          <Field label="Test Name"><Input value={editingTest.name} onChange={v=>setEditingTest(p=>({...p,name:v}))} placeholder="e.g. Unboxing Cinematic v1"/></Field>
          <Field label="Angle">
            <select value={editingTest.angleId||""} onChange={e=>setEditingTest(p=>({...p,angleId:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {angles.map(a=>{const p=getPersona(a.personaId);return <option key={a.id} value={a.id}>{p?.emoji} {a.name}</option>;})}
            </select>
          </Field>
          <Field label="Format"><SelectEl value={editingTest.format} onChange={v=>setEditingTest(p=>({...p,format:v}))} options={FORMATS} className="w-full"/></Field>
          <Field label="Awareness"><SelectEl value={editingTest.awareness} onChange={v=>setEditingTest(p=>({...p,awareness:v}))} options={AWARENESS_STAGES} className="w-full"/></Field>
          <Field label="Status"><SelectEl value={editingTest.status} onChange={v=>setEditingTest(p=>({...p,status:v}))} options={STATUSES} className="w-full"/></Field>
          <Field label="Notes"><textarea value={editingTest.notes} onChange={e=>setEditingTest(p=>({...p,notes:e.target.value}))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"/></Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { if(!editingTest.name.trim()) return; if(editingTest.id) updateTests(ts=>ts.map(t=>t.id===editingTest.id?editingTest:t)); else updateTests(ts=>[...ts,{...editingTest,id:uid()}]); setShowTestModal(false); }}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowTestModal(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          </div>
        </>}
      </Modal>

      {/* ANGLE MODAL */}
      <Modal show={showAngleModal} onClose={() => setShowAngleModal(false)} title={editingAngle?.id?"Edit Angle":"Add Angle"}>
        {editingAngle && <>
          <Field label="Angle Name"><Input value={editingAngle.name} onChange={v=>setEditingAngle(p=>({...p,name:v}))} placeholder="e.g. The Gift That Gets Passed Down"/></Field>
          <Field label="Persona">
            <select value={editingAngle.personaId||""} onChange={e=>setEditingAngle(p=>({...p,personaId:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {personas.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </select>
          </Field>
          <Field label="Emotional Hook"><Input value={editingAngle.hook} onChange={v=>setEditingAngle(p=>({...p,hook:v}))} placeholder="e.g. Heirloom emotion + personalisation"/></Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { if(!editingAngle.name.trim()) return; if(editingAngle.id) updateAngles(as=>as.map(a=>a.id===editingAngle.id?editingAngle:a)); else updateAngles(as=>[...as,{...editingAngle,id:uid()}]); setShowAngleModal(false); }}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowAngleModal(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          </div>
        </>}
      </Modal>

      {/* PERSONA MODAL */}
      <Modal show={showPersonaModal} onClose={() => setShowPersonaModal(false)} title={editingPersona?.id?"Edit Persona":"Add Persona"}>
        {editingPersona && <>
          <Field label="Name"><Input value={editingPersona.name} onChange={v=>setEditingPersona(p=>({...p,name:v}))} placeholder="e.g. The Gift-Giver"/></Field>
          <Field label="Description"><Input value={editingPersona.description||""} onChange={v=>setEditingPersona(p=>({...p,description:v}))} placeholder="Short description"/></Field>
          <Field label="Emoji">
            <div className="flex flex-wrap gap-1">{EMOJI_OPTIONS.map(e=><button key={e} onClick={()=>setEditingPersona(p=>({...p,emoji:e}))} className={`text-xl p-1.5 rounded-lg ${editingPersona.emoji===e?"bg-indigo-100":"hover:bg-gray-100"}`}>{e}</button>)}</div>
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap gap-2">{COLOR_OPTIONS.map(c=><button key={c} onClick={()=>setEditingPersona(p=>({...p,color:c}))} className={`w-8 h-8 rounded-lg border-2 ${editingPersona.color===c?"border-indigo-500":"border-transparent"}`} style={{background:c}}/>)}</div>
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { if(!editingPersona.name.trim()) return; if(editingPersona.id) updatePersonas(ps=>ps.map(p=>p.id===editingPersona.id?editingPersona:p)); else updatePersonas(ps=>[...ps,{...editingPersona,id:uid()}]); setShowPersonaModal(false); }}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowPersonaModal(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          </div>
        </>}
      </Modal>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
