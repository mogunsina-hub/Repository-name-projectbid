import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const CONFIG = {
  verification: { label: "$5 one-time human verification", paymentType: "human_verification" },
  contractorTiers: [
    { key: "free", name: "Free", price: "$0", period: "/month", badge: "Starter", recommended: false, bidLimit: 3, features: ["3 bids/month", "Basic profile", "Standard search placement"] },
    { key: "pro", name: "Pro", price: "$14.99", period: "/month", badge: "Featured", recommended: true, paymentType: "contractor_pro_monthly", bidLimit: Infinity, features: ["Unlimited bids", "Featured Contractor badge", "Priority search ranking"] },
    { key: "verified", name: "Verified", price: "$19.99", period: "/month", badge: "Verified", recommended: false, paymentType: "contractor_verified_monthly", bidLimit: Infinity, features: ["All Pro features", "Verified Contractor badge", "Instant local project notifications"] },
    { key: "universal", name: "Universal", price: "$29.99", period: "/month", badge: "Universal", recommended: false, paymentType: "contractor_universal_monthly", bidLimit: Infinity, features: ["All Verified features", "Bid across provinces/states", "Wider geographic reach"] }
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
    contractor: { label: "Contractor", price: "$15", paymentType: "lead_unlock_contractor" },
    owner: { label: "Owner", price: "$5", paymentType: "lead_unlock_owner" }
  }
};

const sampleProjects = [
  { id: 1, title: "Luxury basement suite renovation", budget: "$35,000 - $55,000", location: "Nanaimo, BC", category: "Renovation", timeline: "8 weeks", posted: "2h ago", rating: 4.9, description: "Create a modern two-bedroom suite with theatre area, gym corner, and premium finishes.", bids: 4, featured: true },
  { id: 2, title: "Duplex framing package", budget: "$120,000 - $180,000", location: "Whitehorse, YT", category: "Framing", timeline: "10 weeks", posted: "1d ago", rating: 4.7, description: "Framing contractor required for multi-unit residential package with permit drawings ready.", bids: 7, featured: false },
  { id: 3, title: "Commercial tenant improvement", budget: "$75,000 - $110,000", location: "Victoria, BC", category: "Commercial", timeline: "6 weeks", posted: "3d ago", rating: 4.8, description: "Interior build-out with flooring, partitions, millwork, and lighting upgrades.", bids: 3, featured: true }
];

const notifications = [
  "New renovation project posted in Nanaimo",
  "Owner viewed your profile",
  "Bid deadline approaching for duplex framing package"
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
  const styles = variant === "secondary"
    ? "bg-white text-slate-950 border border-slate-200 hover:bg-slate-50"
    : variant === "ghost"
    ? "bg-transparent text-slate-700 hover:bg-slate-100"
    : "bg-slate-950 text-white hover:bg-slate-800";
  return <button type={type} disabled={disabled} onClick={onClick} className={`rounded-2xl px-5 py-3 text-sm font-bold transition disabled:opacity-50 ${styles} ${className}`}>{children}</button>;
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-slate-100 bg-white shadow-xl ${className}`}>{children}</div>;
}

function Badge({ children, tone = "slate" }) {
  const tones = { slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-700", blue: "bg-blue-100 text-blue-700", purple: "bg-purple-100 text-purple-700", amber: "bg-amber-100 text-amber-700" };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
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
  const nav = ["Home", "Projects", "Contractor", "Owner", "Messages", "Admin"];
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <button onClick={() => setView("Home")} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white font-black text-slate-950">PB</div>
          <div className="text-left"><p className="font-black">ProjectBid</p><p className="text-xs text-slate-400">Contractor Marketplace</p></div>
        </button>
        <nav className="hidden gap-2 lg:flex">
          {nav.map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${view === item ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>{item}</button>)}
        </nav>
        {user ? <Button onClick={onLogout} variant="secondary">Logout</Button> : <Button onClick={() => setView("Onboarding")} variant="secondary">Get Started</Button>}
      </div>
    </header>
  );
}

function HomePage({ setView }) {
  return (
    <div>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-25 bg-[url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="green">Trusted project bidding</Badge>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight md:text-7xl">Find qualified professionals. Compare bids. Build with confidence.</h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">A clean contractor marketplace for owners, contractors, and suppliers, with project posting, contractor profiles, bid management, gated lead exchange, and optional visibility tools.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button onClick={() => setView("Onboarding")} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">Start Now</Button><Button onClick={() => setView("Projects")} variant="secondary">Browse Projects</Button></div>
          </div>
          <Card className="overflow-hidden bg-white/10 text-white backdrop-blur">
            <div className="h-64 bg-[url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center" />
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <div><p className="text-3xl font-black">3</p><p className="text-sm text-slate-300">Free monthly bids</p></div>
              <div><p className="text-3xl font-black">4</p><p className="text-sm text-slate-300">Contractor tiers</p></div>
              <div><p className="text-3xl font-black">Safe</p><p className="text-sm text-slate-300">Lead exchange</p></div>
            </div>
          </Card>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 md:grid-cols-3">
        {["Post a project", "Compare professionals", "Unlock contact when ready"].map((title, index) => <Card key={title} className="p-6"><div className="text-3xl">{["🏗", "👷", "🔒"][index]}</div><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-2 text-slate-600">A marketplace workflow that keeps the experience focused on project quality, trust, and professional fit.</p></Card>)}
      </section>
    </div>
  );
}

function OnboardingFlow({ user, onMessage }) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState("contractor");
  const progress = step * 20;
  function verify() {
    if (!user) return onMessage("Create or log into an account before paying verification.");
    startCheckout(CONFIG.verification.paymentType, { userId: user.id });
  }
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Card className="p-8">
        <div className="mb-8"><Badge tone="green">Step {step} of 5</Badge><h2 className="mt-4 text-4xl font-black">Welcome to ProjectBid</h2><p className="mt-2 text-slate-600">Complete onboarding to personalize your dashboard.</p><div className="mt-5"><Progress value={progress} /></div></div>
        {step === 1 && <div><h3 className="text-2xl font-black">Build smarter with trusted marketplace tools.</h3><p className="mt-3 text-slate-600">Owners post projects. Contractors bid. Leads stay gated until both sides are ready.</p></div>}
        {step === 2 && <div className="grid gap-4 md:grid-cols-2">{["owner", "contractor"].map((type) => <button key={type} onClick={() => setAccountType(type)} className={`rounded-3xl border p-6 text-left ${accountType === type ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}><div className="text-3xl">{type === "owner" ? "🏠" : "👷"}</div><h3 className="mt-3 text-xl font-black capitalize">{type}</h3><p className="mt-2 text-slate-600">{type === "owner" ? "Post projects and compare contractor bids." : "Create a profile and bid on projects."}</p></button>)}</div>}
        {step === 3 && <div><h3 className="text-2xl font-black">Human verification</h3><p className="mt-2 text-slate-600">A one-time verification helps reduce fake accounts and protects the marketplace.</p><Button onClick={verify} className="mt-5 bg-emerald-600 hover:bg-emerald-700">Complete Verification</Button></div>}
        {step === 4 && <PaymentPreview title="Verification payment" description="Stripe Checkout opens securely when you continue." amount="One-time verification" />}
        {step === 5 && <div className="text-center"><div className="text-6xl">✅</div><h3 className="mt-4 text-3xl font-black">You are ready</h3><p className="mt-2 text-slate-600">Continue to your dashboard.</p></div>}
        <div className="mt-8 flex justify-between"><Button variant="secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>Back</Button><Button onClick={() => setStep(Math.min(step + 1, 5))}>{step === 5 ? "Go to dashboard" : "Continue"}</Button></div>
      </Card>
    </section>
  );
}

function PaymentPreview({ title, description, amount }) {
  return <Card className="border-emerald-100 bg-emerald-50 p-5"><h4 className="font-black text-slate-950">{title}</h4><p className="mt-1 text-slate-600">{description}</p><p className="mt-4 text-sm font-bold text-emerald-700">{amount}</p></Card>;
}

function PricingGrid({ user, profile, onMessage }) {
  const activeTier = profile?.contractor_tier || "free";
  function chooseTier(tier) {
    if (!user) return onMessage("Please log in before selecting a tier.");
    if (!tier.paymentType) return onMessage("Free tier selected. You can bid on 3 projects per month.");
    startCheckout(tier.paymentType, { userId: user.id, tier: tier.key });
  }
  return (
    <div>
      <SectionTitle eyebrow="Contractor subscriptions" title="Choose the right plan" description="The free tier gets you started. Paid tiers unlock more visibility, trust, notifications, and geographic reach." />
      <div className="grid gap-5 lg:grid-cols-4">
        {CONFIG.contractorTiers.map((tier) => <Card key={tier.key} className={`relative flex flex-col p-6 ${tier.recommended ? "ring-2 ring-emerald-400" : ""}`}>
          {tier.recommended && <span className="absolute right-4 top-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">Recommended</span>}
          <Badge tone={tier.key === "verified" ? "blue" : tier.key === "universal" ? "purple" : "slate"}>{tier.badge}</Badge>
          <h3 className="mt-4 text-2xl font-black">{tier.name}</h3><p className="mt-2"><span className="text-3xl font-black">{tier.price}</span><span className="text-slate-500">{tier.period}</span></p>
          <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-700">{tier.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
          <Button className="mt-6" disabled={activeTier === tier.key} onClick={() => chooseTier(tier)}>{activeTier === tier.key ? "Current Plan" : tier.paymentType ? "Upgrade" : "Use Free"}</Button>
        </Card>)}
      </div>
      <FeatureComparison />
    </div>
  );
}

function FeatureComparison() {
  const rows = ["Monthly bid limit", "Featured badge", "Priority search", "Verified badge", "Instant local notifications", "Cross-province/state bidding"];
  return <Card className="mt-8 overflow-hidden"><div className="p-6"><h3 className="text-2xl font-black">Feature comparison</h3></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Feature</th>{CONFIG.contractorTiers.map((t) => <th key={t.key} className="p-4">{t.name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row} className="border-t"><td className="p-4 font-semibold">{row}</td>{CONFIG.contractorTiers.map((tier) => <td key={tier.key} className="p-4">{valueForFeature(row, tier)}</td>)}</tr>)}</tbody></table></div></Card>;
}
function valueForFeature(row, tier) {
  if (row === "Monthly bid limit") return tier.bidLimit === Infinity ? "Unlimited" : tier.bidLimit;
  if (row === "Featured badge") return ["pro", "verified", "universal"].includes(tier.key) ? "✓" : "—";
  if (row === "Priority search") return ["pro", "verified", "universal"].includes(tier.key) ? "✓" : "—";
  if (row === "Verified badge") return ["verified", "universal"].includes(tier.key) ? "✓" : "—";
  if (row === "Instant local notifications") return ["verified", "universal"].includes(tier.key) ? "✓" : "—";
  if (row === "Cross-province/state bidding") return tier.key === "universal" ? "✓" : "—";
  return "—";
}

function ContractorDashboard({ user, profile, setModal, onMessage }) {
  const tier = CONFIG.contractorTiers.find((t) => t.key === (profile?.contractor_tier || "free")) || CONFIG.contractorTiers[0];
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <SectionTitle eyebrow="Contractor dashboard" title="Your professional workspace" description="Track profile strength, bids, notifications, recommended projects, and visibility tools." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><Badge tone="green">{tier.badge}</Badge><h3 className="mt-3 text-2xl font-black">Current tier: {tier.name}</h3><p className="mt-2 text-slate-600">{tier.bidLimit === Infinity ? "Unlimited bids available" : `${tier.bidLimit} bids per month on Free tier`}</p></div><Button onClick={() => setModal("upgrade")}>Upgrade</Button></div></Card>
          <Card className="p-6"><h3 className="text-xl font-black">Profile completeness</h3><p className="mt-2 text-slate-600">Complete your profile to improve owner confidence.</p><div className="mt-4"><Progress value={72} /></div></Card>
          <ProjectRecommendations projects={sampleProjects} />
        </div>
        <div className="space-y-6"><NotificationsPanel /><EarningsPanel /><Button className="w-full" onClick={() => setModal("featured")}>Buy featured listing</Button></div>
      </div>
      <PricingGrid user={user} profile={profile} onMessage={onMessage} />
    </section>
  );
}

function ProjectRecommendations({ projects }) {
  return <Card className="p-6"><h3 className="text-xl font-black">Recommended projects</h3><div className="mt-4 grid gap-4">{projects.slice(0, 2).map((p) => <MiniProject key={p.id} project={p} />)}</div></Card>;
}
function MiniProject({ project }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="font-bold">{project.title}</p><p className="mt-1 text-sm text-slate-600">{project.location} • {project.budget}</p></div>; }
function NotificationsPanel() { return <Card className="p-6"><h3 className="text-xl font-black">Notifications</h3><div className="mt-4 space-y-3">{notifications.map((n) => <div key={n} className="rounded-2xl bg-slate-50 p-3 text-sm">🔔 {n}</div>)}</div></Card>; }
function EarningsPanel() { return <Card className="p-6"><h3 className="text-xl font-black">Earnings overview</h3><p className="mt-3 text-4xl font-black">$0</p><p className="text-sm text-slate-500">Connect awarded contracts to track future earnings.</p></Card>; }

function ProjectsPage({ user, profile, onMessage, setModal }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const filtered = sampleProjects.filter((p) => (category === "All" || p.category === category) && p.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <SectionTitle eyebrow="Projects" title="Browse project opportunities" description="Search, filter, compare, and bid on active projects." />
      <Card className="mb-6 p-4"><div className="grid gap-3 md:grid-cols-4"><input className="rounded-2xl border p-3" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="rounded-2xl border p-3" value={category} onChange={(e) => setCategory(e.target.value)}><option>All</option><option>Renovation</option><option>Framing</option><option>Commercial</option></select><select className="rounded-2xl border p-3"><option>Any budget</option><option>Under $50k</option><option>$50k+</option></select><select className="rounded-2xl border p-3"><option>Sort: newest</option><option>Budget high to low</option><option>Most bids</option></select></div></Card>
      <div className="grid gap-6 lg:grid-cols-3">{filtered.map((project) => <ProjectCard key={project.id} project={project} user={user} profile={profile} onMessage={onMessage} setModal={setModal} />)}</div>
    </section>
  );
}

function ProjectCard({ project, user, profile, onMessage, setModal }) {
  const isVerified = Boolean(profile?.is_verified);
  function bidNow() { if (!user) return onMessage("Please log in to bid."); if (!isVerified) return setModal("verification"); setModal("bid"); }
  return <Card className="overflow-hidden"><div className="h-44 bg-[url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center" /><div className="p-6"><div className="flex justify-between gap-3"><Badge tone={project.featured ? "amber" : "slate"}>{project.featured ? "Featured" : project.category}</Badge><span className="text-sm text-slate-500">{project.posted}</span></div><h3 className="mt-4 text-xl font-black">{project.title}</h3><p className="mt-2 text-slate-600">{project.description}</p><div className="mt-4 grid gap-2 text-sm text-slate-600"><p>📍 {project.location}</p><p>💵 {project.budget}</p><p>⏱ {project.timeline}</p><p>⭐ Owner rating {project.rating}</p></div><div className="mt-5 flex gap-3"><Button onClick={bidNow}>Bid Now</Button><Button variant="secondary" onClick={() => setModal("projectDetail")}>Details</Button></div></div></Card>;
}

function OwnerDashboard({ setModal }) {
  return <section className="mx-auto max-w-7xl px-6 py-10"><SectionTitle eyebrow="Owner dashboard" title="Manage your projects" description="Track projects, contractor responses, ads, lead unlocks, and analytics." /><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="space-y-6"><ProjectManagement /><MessagesPreview /><AnalyticsCards /></div><div className="space-y-6"><LeadStatus /><AdManagement setModal={setModal} /></div></div></section>;
}
function ProjectManagement() { return <Card className="p-6"><h3 className="text-xl font-black">My projects</h3><div className="mt-4 space-y-3">{sampleProjects.slice(0,2).map((p) => <MiniProject key={p.id} project={p} />)}</div></Card>; }
function MessagesPreview() { return <Card className="p-6"><h3 className="text-xl font-black">Messages</h3><p className="mt-2 text-slate-600">Lead contact is protected until unlock is complete.</p></Card>; }
function AnalyticsCards() { return <div className="grid gap-4 md:grid-cols-3">{["Views", "Bids", "Shortlisted"].map((x,i) => <Card key={x} className="p-5"><p className="text-sm text-slate-500">{x}</p><p className="text-3xl font-black">{[184,14,3][i]}</p></Card>)}</div>; }
function LeadStatus() { return <Card className="p-6"><h3 className="text-xl font-black">Lead unlock status</h3><p className="mt-2 text-slate-600">Owner unlock: pending. Contractor unlock: pending.</p></Card>; }
function AdManagement({ setModal }) { return <Card className="p-6"><h3 className="text-xl font-black">Ads purchased</h3><p className="mt-2 text-slate-600">No active ads yet.</p><Button className="mt-4" onClick={() => setModal("ad")}>Create Ad</Button></Card>; }

function MessagingPage({ setModal }) {
  return <section className="mx-auto max-w-6xl px-6 py-10"><SectionTitle eyebrow="Messaging" title="Secure project conversations" description="Chat, file upload, read receipts, and lead-gated contact exchange." /><Card className="overflow-hidden"><div className="grid min-h-[600px] lg:grid-cols-[320px_1fr]"><div className="border-r bg-slate-50 p-5"><h3 className="font-black">Chats</h3>{["Luxury basement", "Framing package"].map((x) => <div key={x} className="mt-3 rounded-2xl bg-white p-3 shadow-sm">{x}</div>)}</div><div className="flex flex-col"><div className="border-b p-5"><h3 className="font-black">Luxury basement renovation</h3><p className="text-sm text-slate-500">Lead details locked until both sides unlock.</p></div><div className="flex-1 space-y-4 p-5"><div className="max-w-md rounded-3xl bg-slate-100 p-4">Can you confirm your availability next week?</div><div className="ml-auto max-w-md rounded-3xl bg-slate-950 p-4 text-white">Yes, I can review the project scope.</div><div className="rounded-3xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-800">Contact details locked</p><p className="mt-1 text-sm text-amber-700">Unlock lead to exchange phone, email, documents, and contracts.</p><Button onClick={() => setModal("lead")} className="mt-3 bg-amber-600 hover:bg-amber-700">Unlock Lead</Button></div></div><div className="border-t p-5"><div className="flex gap-3"><input className="flex-1 rounded-2xl border p-3" placeholder="Type message..." /><Button>Send</Button></div><p className="mt-2 text-xs text-slate-500">Typing indicator • Read receipts • File upload placeholder</p></div></div></div></Card></section>;
}

function AdminDashboard() {
  const rows = ["User management", "Contractor tier management", "Featured listing approvals", "Ads moderation", "Payment logs", "Project moderation"];
  return <section className="mx-auto max-w-7xl px-6 py-10"><SectionTitle eyebrow="Admin" title="Platform control center" description="Moderate users, projects, ads, payments, and contractor tiers." /><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rows.map((r) => <Card key={r} className="p-6"><h3 className="text-xl font-black">{r}</h3><p className="mt-2 text-slate-600">Review, approve, suspend, or update records.</p><Button variant="secondary" className="mt-4">Open</Button></Card>)}</div></section>;
}

function SectionTitle({ eyebrow, title, description }) { return <div className="mb-6"><p className="text-sm uppercase tracking-[0.25em] text-slate-500">{eyebrow}</p><h2 className="mt-2 text-4xl font-black text-slate-950">{title}</h2>{description ? <p className="mt-2 max-w-3xl text-slate-600">{description}</p> : null}</div>; }

function AppModal({ modal, setModal, user }) {
  if (!modal) return null;
  if (modal === "upgrade") return <Modal title="Upgrade contractor plan" onClose={() => setModal(null)}><PricingGrid user={user} profile={{ contractor_tier: "free" }} onMessage={() => {}} /></Modal>;
  if (modal === "verification") return <Modal title="Human verification required" onClose={() => setModal(null)}><p className="text-slate-600">Complete one-time verification to access full marketplace features.</p><Button onClick={() => user && startCheckout(CONFIG.verification.paymentType, { userId: user.id })} className="mt-5 bg-emerald-600 hover:bg-emerald-700">Verify Account</Button></Modal>;
  if (modal === "lead") return <Modal title="Unlock lead exchange" onClose={() => setModal(null)}><LeadUnlockCheckout user={user} /></Modal>;
  if (modal === "featured") return <Modal title="Featured listing purchase" onClose={() => setModal(null)}><FeaturedListingCheckout user={user} /></Modal>;
  if (modal === "ad") return <Modal title="Create advertisement" onClose={() => setModal(null)}><AdCreationForm user={user} /></Modal>;
  if (modal === "bid") return <Modal title="Bid submitted preview" onClose={() => setModal(null)}><p className="text-slate-600">In the connected version, this opens the bid form for the selected project.</p></Modal>;
  if (modal === "projectDetail") return <Modal title="Project details" onClose={() => setModal(null)}><ProjectDetailPreview setModal={setModal} /></Modal>;
  return null;
}
function LeadUnlockCheckout({ user }) { return <div className="grid gap-4 md:grid-cols-2">{Object.values(CONFIG.leadUnlock).map((x) => <Card key={x.paymentType} className="p-5"><h4 className="font-black">{x.label}</h4><p className="mt-2 text-3xl font-black">{x.price}</p><Button className="mt-4" onClick={() => user && startCheckout(x.paymentType, { userId: user.id })}>Pay unlock</Button></Card>)}</div>; }
function FeaturedListingCheckout({ user }) { return <div className="grid gap-4">{CONFIG.featuredListings.map((x) => <Card key={x.key} className="p-5"><h4 className="font-black">{x.label}</h4><p className="text-slate-600">Appear first in search, homepage, and selected categories.</p><Button className="mt-4" onClick={() => user && startCheckout(x.paymentType, { userId: user.id })}>Purchase</Button></Card>)}</div>; }
function AdCreationForm({ user }) { return <form className="grid gap-4"><input className="rounded-2xl border p-3" placeholder="Ad title" /><textarea className="rounded-2xl border p-3" placeholder="Description" /><input className="rounded-2xl border p-3" placeholder="Target city/category" /><div className="rounded-2xl border border-dashed p-6 text-center text-slate-500">Image upload placeholder</div><div className="grid gap-3 md:grid-cols-3">{CONFIG.ads.map((x) => <Button key={x.key} onClick={() => user && startCheckout(x.paymentType, { userId: user.id })}>{x.label}</Button>)}</div></form>; }
function ProjectDetailPreview({ setModal }) { return <div><p className="text-slate-600">Full project description, owner preview, similar projects, and gated contact exchange.</p><Button className="mt-5" onClick={() => setModal("lead")}>Unlock Lead</Button></div>; }

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
      if (currentUser) {
        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
        if (profileData) setProfile(profileData);
      }
    }
    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
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
      {view === "Owner" && <OwnerDashboard setModal={setModal} />}
      {view === "Messages" && <MessagingPage setModal={setModal} />}
      {view === "Admin" && <AdminDashboard />}
      <AppModal modal={modal} setModal={setModal} user={user} />
    </div>
  );
}
