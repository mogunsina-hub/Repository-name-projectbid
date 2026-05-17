import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const CONFIG = {
  verification: { label: "$5 one-time human verification", paymentType: "human_verification" },
  contractorTiers: [
    { key: "free", name: "Free", price: "$0", period: "/month", badge: "Starter", bidLimit: 3, features: ["3 bids/month", "Basic profile", "Standard search placement"] },
    { key: "pro", name: "Pro", price: "$14.99", period: "/month", badge: "Featured", paymentType: "contractor_pro_monthly", bidLimit: Infinity, features: ["Unlimited bids", "Featured Contractor badge", "Priority search ranking"] },
    { key: "verified", name: "Verified", price: "$19.99", period: "/month", badge: "Verified", paymentType: "contractor_verified_monthly", bidLimit: Infinity, features: ["All Pro features", "Verified Contractor badge", "Instant local project notifications"] },
    { key: "universal", name: "Universal", price: "$29.99", period: "/month", badge: "Universal", paymentType: "contractor_universal_monthly", bidLimit: Infinity, features: ["All Verified features", "Bid across provinces/states", "Expanded geographic reach"] }
  ],
  featuredListings: [
    { key: "day", label: "$5/day", paymentType: "featured_listing_day" },
    { key: "week", label: "$15/week", paymentType: "featured_listing_week" },
    { key: "month", label: "$29/month", paymentType: "featured_listing_month" }
  ],
  ads: [
    { key: "day", label: "$5/day", paymentType: "ad_day" },
    { key: "week", label: "$25/week", paymentType: "ad_week" },
    { key: "month", label: "$79/month", paymentType: "ad_month" }
  ],
  leadUnlock: {
    contractor: { label: "Contractor unlock", price: "$15", paymentType: "lead_unlock_contractor" },
    owner: { label: "Owner unlock", price: "$5", paymentType: "lead_unlock_owner" }
  }
};

const demoProjects = [
  { id: "demo-1", title: "Luxury basement suite renovation", budget: "$35,000 - $55,000", location: "Nanaimo, BC", category: "Renovation", timeline: "8 weeks", posted: "Demo", rating: 4.9, description: "Create a modern two-bedroom suite with theatre area, gym corner, and premium finishes.", bids: [], featured: true, status: "Open" },
  { id: "demo-2", title: "Duplex framing package", budget: "$120,000 - $180,000", location: "Whitehorse, YT", category: "Framing", timeline: "10 weeks", posted: "Demo", rating: 4.7, description: "Framing contractor required for multi-unit residential package with permit drawings ready.", bids: [], featured: false, status: "Open" }
];

async function startCheckout(paymentType, metadata = {}) {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentType, ...metadata })
  });

  const data = await response.json();

  if (data.url) window.location.href = data.url;
  else alert(data.error || "Payment could not start.");
}

function Button({ children, className = "", variant = "primary", onClick, type = "button", disabled = false }) {
  const style = variant === "secondary"
    ? "bg-white text-slate-950 border border-slate-200 hover:bg-slate-50"
    : variant === "ghost"
    ? "bg-transparent text-slate-700 hover:bg-slate-100"
    : "bg-slate-950 text-white hover:bg-slate-800";

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`rounded-2xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${style} ${className}`}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-slate-100 bg-white shadow-xl ${className}`}>{children}</div>;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div className="mb-6">
      <p className="text-sm uppercase tracking-[0.25em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-4xl font-black text-slate-950">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-slate-600">{description}</p> : null}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-2xl font-black text-slate-950">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-4 py-2 font-bold text-slate-700">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Progress({ value }) {
  return <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-emerald-500" style={{ width: `${value}%` }} /></div>;
}

function Header({ user, onLogout, view, setView }) {
  const nav = ["Home", "Projects", "Contractor", "Owner", "Messages", "Admin", "Account"];
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <button onClick={() => setView("Home")} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white font-black text-slate-950">PB</div>
          <div className="text-left"><p className="font-black">ProjectBid</p><p className="text-xs text-slate-400">Contractor Marketplace</p></div>
        </button>
        <nav className="hidden gap-2 lg:flex">
          {nav.map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${view === item ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>{item}</button>)}
        </nav>
        {user ? <Button onClick={onLogout} variant="secondary">Logout</Button> : <Button onClick={() => setView("Account")} variant="secondary">Login</Button>}
      </div>
    </header>
  );
}

function AuthPanel({ onMessage }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("project_owner");
  const [loading, setLoading] = useState(false);

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      onMessage("Please enter both email and password.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { role } } });
      onMessage(error ? `Signup error: ${error.message}` : "Signup successful. You are now signed in or ready to log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      onMessage(error ? `Login error: ${error.message}` : "Login successful.");
    }

    setLoading(false);
  }

  return (
    <Card>
      <form onSubmit={handleAuth} className="p-6">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Account</p>
        <h3 className="mt-2 text-2xl font-black text-slate-950">{mode === "signup" ? "Create your account" : "Log in to continue"}</h3>
        <p className="mt-2 text-sm text-slate-500">Sign in to post projects, bid, manage profiles, and access marketplace tools.</p>
        <div className="mt-5 grid gap-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Email address" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Password" />
          {mode === "signup" ? (
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900">
              <option value="project_owner">Project Owner</option>
              <option value="contractor">Contractor</option>
              <option value="supplier">Supplier / Advertiser</option>
            </select>
          ) : null}
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">{loading ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}</Button>
          <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-sm font-semibold text-slate-700 hover:text-slate-950">
            {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function HomePage({ setView }) {
  return (
    <div>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center opacity-25" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="green">Trusted project bidding</Badge>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight md:text-7xl">Find qualified professionals. Compare bids. Build with confidence.</h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">A clean contractor marketplace for owners, contractors, and suppliers.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button onClick={() => setView("Onboarding")} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">Start Now</Button><Button onClick={() => setView("Projects")} variant="secondary">Browse Projects</Button></div>
          </div>
          <Card className="overflow-hidden bg-white/10 text-white backdrop-blur">
            <div className="h-64 bg-[url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center" />
            <div className="grid gap-4 p-6 sm:grid-cols-3"><div><p className="text-3xl font-black">3</p><p className="text-sm text-slate-300">Free monthly bids</p></div><div><p className="text-3xl font-black">4</p><p className="text-sm text-slate-300">Contractor tiers</p></div><div><p className="text-3xl font-black">Safe</p><p className="text-sm text-slate-300">Lead exchange</p></div></div>
          </Card>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 md:grid-cols-3">
        {["Post a project", "Compare professionals", "Unlock contact when ready"].map((title, i) => <Card key={title} className="p-6"><div className="text-3xl">{["🏗", "👷", "🔒"][i]}</div><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-2 text-slate-600">A project-first marketplace experience focused on trust and professional fit.</p></Card>)}
      </section>
    </div>
  );
}

function OnboardingFlow({ user, onMessage }) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState("contractor");
  function verify() {
    if (!user) return onMessage("Create or log into an account before paying verification.");
    startCheckout(CONFIG.verification.paymentType, { userId: user.id });
  }
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Card className="p-8">
        <Badge tone="green">Step {step} of 5</Badge><h2 className="mt-4 text-4xl font-black">Welcome to ProjectBid</h2><div className="mt-5"><Progress value={step * 20} /></div>
        {step === 1 && <p className="mt-6 text-slate-600">Owners post projects. Contractors bid. Leads stay gated until both sides are ready.</p>}
        {step === 2 && <div className="mt-6 grid gap-4 md:grid-cols-2">{["owner", "contractor"].map((type) => <button key={type} onClick={() => setAccountType(type)} className={`rounded-3xl border p-6 text-left ${accountType === type ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}><div className="text-3xl">{type === "owner" ? "🏠" : "👷"}</div><h3 className="mt-3 text-xl font-black capitalize">{type}</h3></button>)}</div>}
        {step === 3 && <div className="mt-6"><h3 className="text-2xl font-black">Human verification</h3><p className="mt-2 text-slate-600">A one-time verification helps reduce fake accounts.</p><Button onClick={verify} className="mt-5 bg-emerald-600 hover:bg-emerald-700">Complete Verification</Button></div>}
        {step === 4 && <PaymentPreview title="Verification payment" description="Stripe Checkout opens securely when you continue." amount="One-time verification" />}
        {step === 5 && <div className="mt-6 text-center"><div className="text-6xl">✅</div><h3 className="mt-4 text-3xl font-black">You are ready</h3></div>}
        <div className="mt-8 flex justify-between"><Button variant="secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>Back</Button><Button onClick={() => setStep(Math.min(step + 1, 5))}>{step === 5 ? "Finish" : "Continue"}</Button></div>
      </Card>
    </section>
  );
}

function PaymentPreview({ title, description, amount }) {
  return <Card className="mt-6 border-emerald-100 bg-emerald-50 p-5"><h4 className="font-black text-slate-950">{title}</h4><p className="mt-1 text-slate-600">{description}</p><p className="mt-4 text-sm font-bold text-emerald-700">{amount}</p></Card>;
}

function VerificationCard({ user, profile, onMessage }) {
  const isVerified = Boolean(profile?.is_verified);

  function verifyAccount() {
    if (!user) {
      onMessage("Please log in before verifying your account.");
      return;
    }
    startCheckout(CONFIG.verification.paymentType, { userId: user.id });
  }

  return (
    <Card className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✅</div>
        <div>
          <h3 className="text-xl font-black text-slate-950">Human verification</h3>
          <p className="mt-1 text-sm text-slate-600">
            {isVerified ? "Your account is verified and can access bidding features." : "Complete the one-time $5 verification before bidding or using full marketplace features."}
          </p>
        </div>
      </div>
      <Button onClick={verifyAccount} disabled={isVerified} className="mt-5 bg-emerald-600 hover:bg-emerald-700">
        {isVerified ? "Verified" : "Verify my account"}
      </Button>
    </Card>
  );
}

function PricingGrid({ user, profile, onMessage }) {
  const activeTier = profile?.contractor_tier || "free";
  function chooseTier(tier) {
    if (!user) return onMessage("Please log in before selecting a tier.");
    if (!tier.paymentType) return onMessage("Free tier selected.");
    startCheckout(tier.paymentType, { userId: user.id, tier: tier.key });
  }
  return (
    <section className="mt-10">
      <SectionTitle eyebrow="Contractor subscriptions" title="Choose the right plan" description="Start free. Upgrade when you need more bids, stronger visibility, notifications, or broader reach." />
      <div className="grid gap-5 lg:grid-cols-4">
        {CONFIG.contractorTiers.map((tier) => <Card key={tier.key} className={`flex flex-col p-6 ${activeTier === tier.key ? "ring-2 ring-emerald-300" : ""}`}><Badge>{tier.badge}</Badge><h3 className="mt-4 text-2xl font-black">{tier.name}</h3><p className="mt-2"><span className="text-3xl font-black">{tier.price}</span><span className="text-slate-500">{tier.period}</span></p><ul className="mt-5 flex-1 space-y-3 text-sm text-slate-700">{tier.features.map((f) => <li key={f}>✓ {f}</li>)}</ul><Button className="mt-6" disabled={activeTier === tier.key} onClick={() => chooseTier(tier)}>{activeTier === tier.key ? "Current Plan" : tier.paymentType ? "Upgrade" : "Use Free"}</Button></Card>)}
      </div>
    </section>
  );
}

function ProjectsPage({ user, profile, onMessage, setModal }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    setLoading(true);
    const { data: projectData, error: projectError } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (projectError) { setProjects(demoProjects); setLoading(false); return; }
    const { data: bidData } = await supabase.from("bids").select("*");
    const merged = (projectData || []).map((project) => ({ ...project, bids: (bidData || []).filter((bid) => bid.project_id === project.id) }));
    setProjects(merged.length > 0 ? merged : demoProjects);
    setLoading(false);
  }

  const filtered = projects.filter((p) => (category === "All" || p.category === category) && (p.title || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <SectionTitle eyebrow="Projects" title="Browse project opportunities" description="Search, filter, compare, and bid on active projects." />
      <Card className="mb-6 p-4"><div className="grid gap-3 md:grid-cols-4"><input className="rounded-2xl border p-3" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="rounded-2xl border p-3" value={category} onChange={(e) => setCategory(e.target.value)}><option>All</option><option>Renovation</option><option>Framing</option><option>Commercial</option><option>Plumbing</option><option>Electrical</option><option>Landscaping</option></select><select className="rounded-2xl border p-3"><option>Any budget</option><option>Under $50k</option><option>$50k+</option></select><select className="rounded-2xl border p-3"><option>Sort: newest</option><option>Budget high to low</option><option>Most bids</option></select></div></Card>
      {loading ? <Card className="p-8 text-center text-slate-600">Loading projects...</Card> : <div className="grid gap-6 lg:grid-cols-3">{filtered.map((project) => <ProjectCard key={project.id} project={project} user={user} profile={profile} onMessage={onMessage} setModal={setModal} />)}</div>}
    </section>
  );
}

function ProjectCard({ project, user, profile, onMessage, setModal }) {
  const isVerified = Boolean(profile?.is_verified);
  function bidNow() {
    if (!user) return onMessage("Please log in to bid.");
    if (!isVerified) return setModal("verification");
    setModal({ type: "bid", project });
  }
  return <Card className="overflow-hidden"><div className="h-44 bg-[url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center" /><div className="p-6"><div className="flex justify-between gap-3"><Badge tone={project.featured ? "amber" : "slate"}>{project.featured ? "Featured" : project.category || "Project"}</Badge><span className="text-sm text-slate-500">{project.posted || "Open"}</span></div><h3 className="mt-4 text-xl font-black">{project.title}</h3><p className="mt-2 text-slate-600">{project.description}</p><div className="mt-4 grid gap-2 text-sm text-slate-600"><p>📍 {project.location}</p><p>💵 {project.budget}</p><p>⭐ Owner rating {project.rating || "New"}</p><p>📄 {(project.bids || []).length} bids</p></div><div className="mt-5 flex gap-3"><Button onClick={bidNow}>Bid Now</Button><Button variant="secondary" onClick={() => setModal("projectDetail")}>Details</Button></div></div></Card>;
}

function CreateProjectForm({ user, onMessage }) {
  const [form, setForm] = useState({ title: "", location: "", category: "Renovation", budget: "", description: "" });
  const [saving, setSaving] = useState(false);
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function createProject(event) {
    event.preventDefault();
    if (!user) return onMessage("Please log in before creating a project.");
    if (!form.title.trim() || !form.location.trim()) return onMessage("Please enter a project title and location.");

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      owner: user.email || "Project Owner",
      location: form.location.trim(),
      category: form.category || "New Project",
      budget: form.budget.trim() || "Budget to be confirmed",
      description: form.description.trim() || "Project details will be added soon.",
      status: "Open"
    };
    const { error } = await supabase.from("projects").insert([payload]).select();
    setSaving(false);
    if (error) return onMessage(`Could not create project: ${error.message}`);
    setForm({ title: "", location: "", category: "Renovation", budget: "", description: "" });
    onMessage("Project created successfully. Open Projects to view it.");
  }

  return (
    <Card className="p-6">
      <h3 className="text-xl font-black text-slate-950">Create a project</h3><p className="mt-1 text-sm text-slate-500">Post a project and start receiving contractor bids.</p>
      <form onSubmit={createProject} className="mt-5 grid gap-3">
        <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Project title" />
        <div className="grid gap-3 md:grid-cols-2"><input value={form.location} onChange={(e) => updateField("location", e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Location" /><select value={form.category} onChange={(e) => updateField("category", e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900"><option>Renovation</option><option>Framing</option><option>Commercial</option><option>Plumbing</option><option>Electrical</option><option>Landscaping</option></select></div>
        <input value={form.budget} onChange={(e) => updateField("budget", e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Budget range" />
        <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} className="min-h-28 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Describe the scope, drawings, timeline, permits, and expectations" />
        <Button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800">{saving ? "Creating..." : "Create project"}</Button>
      </form>
    </Card>
  );
}

function OwnerDashboard({ user, setModal, onMessage }) {
  return <section className="mx-auto max-w-7xl px-6 py-10"><SectionTitle eyebrow="Owner dashboard" title="Manage your projects" description="Create projects, track contractor responses, lead unlocks, ads, and analytics." /><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="space-y-6"><CreateProjectForm user={user} onMessage={onMessage} /><ProjectManagement /><MessagesPreview /><AnalyticsCards /></div><div className="space-y-6"><LeadStatus /><AdManagement setModal={setModal} /></div></div></section>;
}

function ProjectManagement() { return <Card className="p-6"><h3 className="text-xl font-black">My projects</h3><div className="mt-4 space-y-3">{demoProjects.map((p) => <MiniProject key={p.id} project={p} />)}</div></Card>; }
function MiniProject({ project }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="font-bold">{project.title}</p><p className="mt-1 text-sm text-slate-600">{project.location} • {project.budget}</p></div>; }
function MessagesPreview() { return <Card className="p-6"><h3 className="text-xl font-black">Messages</h3><p className="mt-2 text-slate-600">Lead contact is protected until unlock is complete.</p></Card>; }
function AnalyticsCards() { return <div className="grid gap-4 md:grid-cols-3">{["Views", "Bids", "Shortlisted"].map((x, i) => <Card key={x} className="p-5"><p className="text-sm text-slate-500">{x}</p><p className="text-3xl font-black">{[184, 14, 3][i]}</p></Card>)}</div>; }
function LeadStatus() { return <Card className="p-6"><h3 className="text-xl font-black">Lead unlock status</h3><p className="mt-2 text-slate-600">Owner unlock: pending. Contractor unlock: pending.</p></Card>; }
function AdManagement({ setModal }) { return <Card className="p-6"><h3 className="text-xl font-black">Ads purchased</h3><p className="mt-2 text-slate-600">No active ads yet.</p><Button className="mt-4" onClick={() => setModal("ad")}>Create Ad</Button></Card>; }

function ContractorDashboard({ user, profile, setModal, onMessage }) {
  const tier = CONFIG.contractorTiers.find((t) => t.key === (profile?.contractor_tier || "free")) || CONFIG.contractorTiers[0];
  return <section className="mx-auto max-w-7xl px-6 py-10"><SectionTitle eyebrow="Contractor dashboard" title="Your professional workspace" description="Track profile strength, bids, notifications, recommended projects, and visibility tools." /><div className="mb-6"><VerificationCard user={user} profile={profile} onMessage={onMessage} /></div><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="space-y-6"><Card className="p-6"><Badge tone="green">{tier.badge}</Badge><h3 className="mt-3 text-2xl font-black">Current tier: {tier.name}</h3><p className="mt-2 text-slate-600">{tier.bidLimit === Infinity ? "Unlimited bids available" : `${tier.bidLimit} bids per month on Free tier`}</p><Button onClick={() => setModal("upgrade")} className="mt-5">Upgrade</Button></Card><Card className="p-6"><h3 className="text-xl font-black">Profile completeness</h3><div className="mt-4"><Progress value={72} /></div></Card><ProjectRecommendations projects={demoProjects} /></div><div className="space-y-6"><NotificationsPanel /><EarningsPanel /><Button className="w-full" onClick={() => setModal("featured")}>Buy featured listing</Button></div></div><PricingGrid user={user} profile={profile} onMessage={onMessage} /></section>;
}
function ProjectRecommendations({ projects }) { return <Card className="p-6"><h3 className="text-xl font-black">Recommended projects</h3><div className="mt-4 grid gap-4">{projects.map((p) => <MiniProject key={p.id} project={p} />)}</div></Card>; }
function NotificationsPanel() { return <Card className="p-6"><h3 className="text-xl font-black">Notifications</h3><div className="mt-4 space-y-3">{["New project posted nearby", "Owner viewed your profile", "Bid deadline approaching"].map((n) => <div key={n} className="rounded-2xl bg-slate-50 p-3 text-sm">🔔 {n}</div>)}</div></Card>; }
function EarningsPanel() { return <Card className="p-6"><h3 className="text-xl font-black">Earnings overview</h3><p className="mt-3 text-4xl font-black">$0</p><p className="text-sm text-slate-500">Track future awarded contracts here.</p></Card>; }

function MessagingPage({ setModal }) { return <section className="mx-auto max-w-6xl px-6 py-10"><SectionTitle eyebrow="Messaging" title="Secure project conversations" description="Chat, file upload, read receipts, and lead-gated contact exchange." /><Card className="p-6"><p className="text-slate-600">Contact details are gated until lead unlock is complete.</p><Button onClick={() => setModal("lead")} className="mt-5">Unlock Lead</Button></Card></section>; }
function AdminDashboard() { return <section className="mx-auto max-w-7xl px-6 py-10"><SectionTitle eyebrow="Admin" title="Platform control center" description="Moderate users, projects, ads, payments, and contractor tiers." /><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{["User management", "Tier management", "Ads moderation", "Payment logs", "Project moderation", "Approvals"].map((r) => <Card key={r} className="p-6"><h3 className="text-xl font-black">{r}</h3><Button variant="secondary" className="mt-4">Open</Button></Card>)}</div></section>; }

function BidSubmissionForm({ project, user, profile, onMessage, onClose, onBidSaved }) {
  const [form, setForm] = useState({ bid_amount: "", timeline: "", proposal: "" });
  const [submitting, setSubmitting] = useState(false);
  const [monthlyBidCount, setMonthlyBidCount] = useState(0);

  const tierKey = profile?.contractor_tier || "free";
  const tier = CONFIG.contractorTiers.find((item) => item.key === tierKey) || CONFIG.contractorTiers[0];
  const bidLimit = tier.bidLimit;
  const isVerified = Boolean(profile?.is_verified);
  const remainingBids = bidLimit === Infinity ? Infinity : Math.max(bidLimit - monthlyBidCount, 0);
  const canBid = isVerified && (bidLimit === Infinity || remainingBids > 0);

  useEffect(() => {
    if (user?.id) fetchMonthlyBidCount();
  }, [user?.id]);

  async function fetchMonthlyBidCount() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    if (!error) setMonthlyBidCount(count || 0);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitBid(event) {
    event.preventDefault();

    if (!user) return onMessage("Please log in before submitting a bid.");
    if (!project?.id || String(project.id).startsWith("demo")) return onMessage("Please create or select a real Supabase project before bidding.");
    if (!isVerified) return onMessage("Please complete human verification before bidding.");
    if (!canBid) return onMessage("Free tier bid limit reached. Upgrade to Pro for unlimited bids.");
    if (!form.bid_amount.trim() || !form.timeline.trim()) return onMessage("Please enter bid amount and timeline.");

    setSubmitting(true);

    const { error } = await supabase.from("bids").insert([
      {
        project_id: project.id,
        contractor_id: user.id,
        contractor_email: user.email,
        company_name: profile?.company_name || user.email,
        bid_amount: form.bid_amount.trim(),
        timeline: form.timeline.trim(),
        proposal: form.proposal.trim(),
        status: "pending"
      }
    ]);

    setSubmitting(false);

    if (error) {
      onMessage(`Could not submit bid: ${error.message}`);
      return;
    }

    onMessage("Bid submitted successfully.");
    onBidSaved?.();
    onClose?.();
  }

  if (!project) {
    return <p className="text-slate-600">No project selected.</p>;
  }

  return (
    <form onSubmit={submitBid} className="grid gap-4">
      <Card className="bg-slate-50 p-4 shadow-none">
        <h4 className="font-black text-slate-950">{project.title}</h4>
        <p className="mt-1 text-sm text-slate-600">{project.location} • {project.budget}</p>
      </Card>

      <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
        Current plan: <strong>{tier.name}</strong>. {bidLimit === Infinity ? "Unlimited bids available." : `${remainingBids} of ${bidLimit} free monthly bids remaining.`}
      </div>

      {!isVerified ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Complete human verification before submitting bids.</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.bid_amount} onChange={(e) => updateField("bid_amount", e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Bid amount, e.g. $42,500" />
        <input value={form.timeline} onChange={(e) => updateField("timeline", e.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Timeline, e.g. 8 weeks" />
      </div>
      <textarea value={form.proposal} onChange={(e) => updateField("proposal", e.target.value)} className="min-h-32 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Describe your scope, assumptions, exclusions, experience, warranty, and next steps" />
      <Button type="submit" disabled={!canBid || submitting} className="bg-blue-700 hover:bg-blue-800">
        {submitting ? "Submitting..." : "Submit bid"}
      </Button>
    </form>
  );
}

function LeadUnlockCheckout({ user }) { return <div className="grid gap-4 md:grid-cols-2">{Object.values(CONFIG.leadUnlock).map((x) => <Card key={x.paymentType} className="p-5"><h4 className="font-black">{x.label}</h4><p className="mt-2 text-3xl font-black">{x.price}</p><Button className="mt-4" onClick={() => user && startCheckout(x.paymentType, { userId: user.id })}>Pay unlock</Button></Card>)}</div>; }
function FeaturedListingCheckout({ user }) { return <div className="grid gap-4">{CONFIG.featuredListings.map((x) => <Card key={x.key} className="p-5"><h4 className="font-black">{x.label}</h4><p className="text-slate-600">Appear first in search, homepage, and selected categories.</p><Button className="mt-4" onClick={() => user && startCheckout(x.paymentType, { userId: user.id })}>Purchase</Button></Card>)}</div>; }
function AdCreationForm({ user }) { return <form className="grid gap-4"><input className="rounded-2xl border p-3" placeholder="Ad title" /><textarea className="rounded-2xl border p-3" placeholder="Description" /><input className="rounded-2xl border p-3" placeholder="Target city/category" /><div className="rounded-2xl border border-dashed p-6 text-center text-slate-500">Image upload placeholder</div><div className="grid gap-3 md:grid-cols-3">{CONFIG.ads.map((x) => <Button key={x.key} onClick={() => user && startCheckout(x.paymentType, { userId: user.id })}>{x.label}</Button>)}</div></form>; }
function ProjectDetailPreview({ setModal }) { return <div><p className="text-slate-600">Full project description, owner preview, similar projects, and gated contact exchange.</p><Button className="mt-5" onClick={() => setModal("lead")}>Unlock Lead</Button></div>; }

function AppModal({ modal, setModal, user, profile, onMessage, onBidSaved }) {
  if (!modal) return null;

  const modalType = typeof modal === "string" ? modal : modal.type;
  const modalProject = typeof modal === "object" ? modal.project : null;

  if (modalType === "upgrade") return <Modal title="Upgrade contractor plan" onClose={() => setModal(null)}><PricingGrid user={user} profile={profile} onMessage={onMessage} /></Modal>;
  if (modalType === "verification") return <Modal title="Human verification required" onClose={() => setModal(null)}><p className="text-slate-600">Complete one-time verification to access full marketplace features.</p><Button onClick={() => user && startCheckout(CONFIG.verification.paymentType, { userId: user.id })} className="mt-5 bg-emerald-600 hover:bg-emerald-700">Verify Account</Button></Modal>;
  if (modalType === "lead") return <Modal title="Unlock lead exchange" onClose={() => setModal(null)}><LeadUnlockCheckout user={user} /></Modal>;
  if (modalType === "featured") return <Modal title="Featured listing purchase" onClose={() => setModal(null)}><FeaturedListingCheckout user={user} /></Modal>;
  if (modalType === "ad") return <Modal title="Create advertisement" onClose={() => setModal(null)}><AdCreationForm user={user} /></Modal>;
  if (modalType === "bid") return <Modal title="Submit bid" onClose={() => setModal(null)}><BidSubmissionForm project={modalProject} user={user} profile={profile} onMessage={onMessage} onClose={() => setModal(null)} onBidSaved={onBidSaved} /></Modal>;
  if (modalType === "projectDetail") return <Modal title="Project details" onClose={() => setModal(null)}><ProjectDetailPreview setModal={setModal} /></Modal>;
  return null;
}

export default function App() {
  const [view, setView] = useState("Home");
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ contractor_tier: "free", is_verified: false });

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user || null;
      setUser(currentUser);
      if (currentUser) await fetchProfile(currentUser.id);
    }
    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser.id);
      else setProfile({ contractor_tier: "free", is_verified: false });
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) setProfile(data);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile({ contractor_tier: "free", is_verified: false });
    setView("Home");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header user={user} onLogout={logout} view={view} setView={setView} />
      {message ? <div className="mx-auto mt-6 max-w-7xl rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{message}</div> : null}
      {view === "Home" && <HomePage setView={setView} />}
      {view === "Onboarding" && <OnboardingFlow user={user} onMessage={setMessage} />}
      {view === "Projects" && <ProjectsPage user={user} profile={profile} onMessage={setMessage} setModal={setModal} />}
      {view === "Contractor" && <ContractorDashboard user={user} profile={profile} setModal={setModal} onMessage={setMessage} />}
      {view === "Owner" && <OwnerDashboard user={user} setModal={setModal} onMessage={setMessage} />}
      {view === "Messages" && <MessagingPage setModal={setModal} />}
      {view === "Admin" && <AdminDashboard />}
      {view === "Account" && (
        <section className="mx-auto max-w-3xl px-6 py-10">
          <SectionTitle eyebrow="Account" title={user ? "Account details" : "Log in or create account"} description="Sign in and complete verification before using protected marketplace features." />
          {user ? (
            <div className="space-y-6">
              <Card className="p-6">
                <p className="text-sm text-slate-500">Logged in as</p>
                <p className="mt-1 text-xl font-black text-slate-950">{user.email}</p>
                <Button onClick={logout} className="mt-5">Logout</Button>
              </Card>
              <VerificationCard user={user} profile={profile} onMessage={setMessage} />
            </div>
          ) : (
            <AuthPanel onMessage={setMessage} />
          )}
        </section>
      )}
      {view === "Account" && (
        <section className="mx-auto max-w-3xl px-6 py-10">
          <SectionTitle eyebrow="Account" title={user ? "You are logged in" : "Log in or create account"} description="Sign in before creating projects, bidding, saving profiles, or purchasing marketplace features." />
          {user ? (
            <Card className="p-6">
              <p className="text-sm text-slate-500">Logged in as</p>
              <p className="mt-1 text-xl font-black text-slate-950">{user.email}</p>
              <Button onClick={logout} className="mt-5">Logout</Button>
            </Card>
          ) : (
            <AuthPanel onMessage={setMessage} />
          )}
        </section>
      )}
      <AppModal modal={modal} setModal={setModal} user={user} profile={profile} onMessage={setMessage} onBidSaved={() => setView("Projects")} />
    </div>
  );
}
