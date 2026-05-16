import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

// =====================================================
// CENTRAL PLATFORM CONFIG
// All prices, payment types, limits, and privileges live here.
// Update this object first when changing monetization rules.
// =====================================================
const PLATFORM_CONFIG = {
  verification: {
    label: "$5 one-time human verification",
    amount: 5,
    paymentType: "human_verification",
    description: "A one-time check that helps keep the marketplace real and reduces fake accounts."
  },
  contractorTiers: {
    free: {
      key: "free",
      name: "Free Contractor",
      priceLabel: "$0/month",
      paymentType: null,
      monthlyBidLimit: 3,
      badge: "Starter",
      searchPriority: 0,
      canBidNationwide: false,
      canReceiveInstantAreaNotifications: false,
      features: [
        "Bid on 3 projects per month",
        "Basic contractor profile",
        "Standard search placement"
      ]
    },
    pro: {
      key: "pro",
      name: "Pro Contractor",
      priceLabel: "$14.99/month",
      paymentType: "contractor_pro_monthly",
      monthlyBidLimit: Infinity,
      badge: "Featured Contractor",
      searchPriority: 1,
      canBidNationwide: false,
      canReceiveInstantAreaNotifications: false,
      features: [
        "Unlimited bids",
        "Featured Contractor badge",
        "Priority ranking in search results"
      ]
    },
    verified: {
      key: "verified",
      name: "Verified Contractor",
      priceLabel: "$19.99/month",
      paymentType: "contractor_verified_monthly",
      monthlyBidLimit: Infinity,
      badge: "Verified Contractor",
      searchPriority: 2,
      canBidNationwide: false,
      canReceiveInstantAreaNotifications: true,
      features: [
        "All Pro Contractor privileges",
        "Verified Contractor badge",
        "Instant notifications for new projects in your area"
      ]
    },
    universal: {
      key: "universal",
      name: "Universal Contractor",
      priceLabel: "$29.99/month",
      paymentType: "contractor_universal_monthly",
      monthlyBidLimit: Infinity,
      badge: "Universal Contractor",
      searchPriority: 3,
      canBidNationwide: true,
      canReceiveInstantAreaNotifications: true,
      features: [
        "All Verified Contractor privileges",
        "Bid on projects across provinces or states in your country",
        "Expanded geographic reach"
      ]
    }
  },
  featuredListings: [
    {
      key: "featured_day",
      label: "$5/day",
      paymentType: "featured_listing_day",
      description: "Temporary boost to appear first in search for one day."
    },
    {
      key: "featured_week",
      label: "$15/week",
      paymentType: "featured_listing_week",
      description: "Featured placement on search, homepage, and selected cities/categories for one week."
    },
    {
      key: "featured_month",
      label: "$29/month",
      paymentType: "featured_listing_month",
      description: "Monthly featured visibility across search, homepage, and specific categories."
    }
  ],
  leadUnlock: {
    contractor: {
      label: "Contractor unlock",
      amountLabel: "$15",
      paymentType: "lead_unlock_contractor"
    },
    owner: {
      label: "Owner unlock",
      amountLabel: "$5",
      paymentType: "lead_unlock_owner"
    }
  },
  advertisements: [
    {
      key: "ad_day",
      label: "$5/day",
      paymentType: "ad_day",
      description: "Daily ad placement on homepage, contractor dashboard, or project detail pages."
    },
    {
      key: "ad_week",
      label: "$25/week",
      paymentType: "ad_week",
      description: "Weekly ad visibility for owners, contractors, and suppliers."
    },
    {
      key: "ad_month",
      label: "$79/month",
      paymentType: "ad_month",
      description: "Monthly advertising package across key marketplace pages."
    }
  ]
};

const DEFAULT_TIER = PLATFORM_CONFIG.contractorTiers.free;

// =====================================================
// STRIPE CHECKOUT HELPER
// Vercel serverless API receives paymentType and metadata.
// =====================================================
async function startCheckout(paymentType, metadata = {}) {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentType, ...metadata })
  });

  const data = await response.json();

  if (data.url) {
    window.location.href = data.url;
  } else {
    alert(data.error || "Payment could not start.");
  }
}

// =====================================================
// SMALL UI BUILDING BLOCKS
// =====================================================
function AppButton({ children, className = "", type = "button", onClick, variant = "solid", disabled = false }) {
  const variantClass =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
      : "bg-slate-950 text-white hover:bg-slate-800";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl bg-white shadow-xl ${className}`}>{children}</div>;
}

function StatCard({ emoji, label, value }) {
  return (
    <Card className="bg-white/90">
      <div className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-2xl text-white">{emoji}</div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="mb-6">
      <p className="text-sm uppercase tracking-[0.25em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-4xl font-black text-slate-950">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-slate-600">{description}</p> : null}
    </div>
  );
}

// =====================================================
// AUTHENTICATION
// Existing Supabase auth retained.
// =====================================================
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
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role } }
      });

      if (error) {
        onMessage(`Signup error: ${error.message}`);
      } else {
        onMessage("Signup successful. Complete human verification when you are ready to activate full marketplace access.");
      }
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
        <p className="mt-2 text-sm text-slate-500">Sign in to post projects, bid, manage profiles, and unlock advanced marketplace features.</p>

        <div className="mt-5 grid gap-3">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Email address" />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Password" />

          {mode === "signup" ? (
            <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900">
              <option value="project_owner">Project Owner</option>
              <option value="contractor">Contractor</option>
              <option value="supplier">Supplier / Advertiser</option>
            </select>
          ) : null}

          <AppButton type="submit" className="bg-emerald-600 hover:bg-emerald-700">{loading ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}</AppButton>

          <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-sm font-semibold text-slate-700 hover:text-slate-950">
            {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>
      </form>
    </Card>
  );
}

// =====================================================
// HUMAN VERIFICATION
// Replaces old $1 enrollment fee with $5 one-time verification.
// =====================================================
function HumanVerificationPanel({ user, profile, onMessage }) {
  const isVerified = Boolean(profile?.is_verified);

  function handleVerification() {
    if (!user) {
      onMessage("Please log in before completing human verification.");
      return;
    }

    startCheckout(PLATFORM_CONFIG.verification.paymentType, { userId: user.id });
  }

  return (
    <Card className="border border-emerald-100 bg-gradient-to-br from-white to-emerald-50">
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✅</div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">Human verification</h3>
            <p className="mt-1 text-sm text-slate-500">{isVerified ? "Your account is verified." : PLATFORM_CONFIG.verification.description}</p>
          </div>
        </div>
        <AppButton onClick={handleVerification} disabled={isVerified} className="mt-5 bg-emerald-600 hover:bg-emerald-700">
          {isVerified ? "Verified" : "Complete verification"}
        </AppButton>
      </div>
    </Card>
  );
}

// =====================================================
// CONTRACTOR TIERS
// UI and logic use central config. Free tier is enforced in bid form.
// =====================================================
function ContractorTiersPanel({ user, profile, onMessage }) {
  const activeTier = profile?.contractor_tier || "free";

  function chooseTier(tier) {
    if (!user) {
      onMessage("Please log in before selecting a contractor tier.");
      return;
    }

    if (!tier.paymentType) {
      onMessage("Free Contractor tier active. Free contractors can bid on up to 3 projects per month.");
      return;
    }

    startCheckout(tier.paymentType, { userId: user.id, tier: tier.key });
  }

  return (
    <section className="mt-8">
      <SectionHeader
        eyebrow="Professional tools"
        title="Choose how you want to compete"
        description="Start free. Upgrade only when you need more bids, stronger visibility, instant local project notifications, or wider service territory."
      />
      <div className="grid gap-5 lg:grid-cols-4">
        {Object.values(PLATFORM_CONFIG.contractorTiers).map((tier) => {
          const isActive = activeTier === tier.key;
          return (
            <Card key={tier.key} className={`flex flex-col border p-6 ${isActive ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-100"}`}>
              <div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{tier.badge}</span>
                <h3 className="mt-4 text-xl font-black text-slate-950">{tier.name}</h3>
                <p className="mt-2 text-2xl font-black text-slate-950">{tier.priceLabel}</p>
              </div>
              <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-700">
                {tier.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
              </ul>
              <AppButton onClick={() => chooseTier(tier)} disabled={isActive} className="mt-6">
                {isActive ? "Current plan" : tier.paymentType ? "Upgrade" : "Use free tier"}
              </AppButton>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// =====================================================
// FEATURED LISTINGS + ADS
// Hidden until users request promotion tools.
// =====================================================
function PromotionPanel({ title, description, options, user, onMessage }) {
  function startPromotion(option) {
    if (!user) {
      onMessage("Please log in before purchasing visibility tools.");
      return;
    }

    startCheckout(option.paymentType, { userId: user.id });
  }

  return (
    <Card className="p-6">
      <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Optional visibility</p>
      <h3 className="mt-2 text-2xl font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-5 grid gap-3">
        {options.map((option) => (
          <div key={option.key} className="rounded-2xl border bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-slate-950">{option.label}</p>
                <p className="text-sm text-slate-600">{option.description}</p>
              </div>
              <AppButton onClick={() => startPromotion(option)} className="shrink-0">Purchase</AppButton>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// =====================================================
// LEAD UNLOCK GATING
// UI blocks sensitive exchange until both sides have paid.
// Backend tables can later track owner_paid and contractor_paid per lead.
// =====================================================
function LeadUnlockPanel({ user, onMessage }) {
  function payLeadUnlock(role) {
    if (!user) {
      onMessage("Please log in before unlocking direct contact exchange.");
      return;
    }

    const paymentType = role === "contractor" ? PLATFORM_CONFIG.leadUnlock.contractor.paymentType : PLATFORM_CONFIG.leadUnlock.owner.paymentType;
    startCheckout(paymentType, { userId: user.id, leadRole: role });
  }

  return (
    <Card className="border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6">
      <p className="text-sm uppercase tracking-[0.25em] text-blue-700">Lead unlock</p>
      <h3 className="mt-2 text-2xl font-black text-slate-950">Connect safely when ready</h3>
      <p className="mt-2 text-slate-600">Phone numbers, email addresses, documents, and contract files stay gated until both sides unlock the lead.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <AppButton onClick={() => payLeadUnlock("contractor")} className="bg-blue-700 hover:bg-blue-800">Contractor unlock</AppButton>
        <AppButton onClick={() => payLeadUnlock("owner")} className="bg-emerald-700 hover:bg-emerald-800">Owner unlock</AppButton>
      </div>
    </Card>
  );
}

// =====================================================
// BIDDING
// Enforces tier privileges in UI + logic.
// Free contractors are limited to 3 bids/month.
// Universal contractors may bid outside local territory.
// =====================================================
function BidForm({ project, user, profile, monthlyBidCount, onMessage, onBidSaved }) {
  const [bidAmount, setBidAmount] = useState("");
  const [timeline, setTimeline] = useState("");
  const [proposal, setProposal] = useState("");
  const [loading, setLoading] = useState(false);

  const tierKey = profile?.contractor_tier || "free";
  const tier = PLATFORM_CONFIG.contractorTiers[tierKey] || DEFAULT_TIER;
  const isVerified = Boolean(profile?.is_verified);
  const remainingFreeBids = tier.monthlyBidLimit === Infinity ? Infinity : Math.max(tier.monthlyBidLimit - monthlyBidCount, 0);
  const canSubmitBid = isVerified && (tier.monthlyBidLimit === Infinity || monthlyBidCount < tier.monthlyBidLimit);

  async function submitBid(event) {
    event.preventDefault();

    if (!user) {
      onMessage("Please log in before submitting a bid.");
      return;
    }

    if (!isVerified) {
      onMessage("Please complete human verification before submitting bids.");
      return;
    }

    if (!canSubmitBid) {
      onMessage("Free Contractor bid limit reached. Upgrade to Pro for unlimited bids.");
      return;
    }

    if (!bidAmount.trim() || !timeline.trim()) {
      onMessage("Please enter a bid amount and timeline.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("bids").insert([
      {
        project_id: project.id,
        contractor_id: user.id,
        contractor_email: user.email,
        company_name: profile?.company_name || user.email,
        bid_amount: bidAmount.trim(),
        timeline: timeline.trim(),
        proposal: proposal.trim(),
        status: "pending"
      }
    ]);

    setLoading(false);

    if (error) {
      onMessage(`Could not submit bid: ${error.message}`);
      return;
    }

    setBidAmount("");
    setTimeline("");
    setProposal("");
    onMessage("Bid submitted successfully.");
    onBidSaved();
  }

  return (
    <form onSubmit={submitBid} className="mt-5 rounded-2xl border bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h5 className="font-bold text-slate-950">Submit your bid</h5>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {tier.monthlyBidLimit === Infinity ? "Unlimited bids" : `${remainingFreeBids} free bid(s) left this month`}
        </span>
      </div>

      {!isVerified ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Complete human verification before bidding.</p> : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} className="rounded-2xl border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Bid amount, e.g. $42,500" />
        <input value={timeline} onChange={(event) => setTimeline(event.target.value)} className="rounded-2xl border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Timeline, e.g. 8 weeks" />
      </div>
      <textarea value={proposal} onChange={(event) => setProposal(event.target.value)} className="mt-3 min-h-24 w-full rounded-2xl border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Proposal details, experience, materials, exclusions, warranty, and notes" />
      <AppButton type="submit" disabled={!canSubmitBid || loading} className="mt-3 bg-blue-700 hover:bg-blue-800">{loading ? "Submitting..." : "Submit bid"}</AppButton>
    </form>
  );
}

function ProjectCard({ project, user, profile, monthlyBidCount, onMessage, onBidSaved }) {
  const bids = project.bids || [];

  async function acceptBid(bid) {
    if (!user) {
      onMessage("Please log in before accepting a bid.");
      return;
    }

    const { error: bidError } = await supabase.from("bids").update({ status: "rejected" }).eq("project_id", project.id);
    if (bidError) {
      onMessage(`Could not update other bids: ${bidError.message}`);
      return;
    }

    const { error: acceptedBidError } = await supabase.from("bids").update({ status: "accepted" }).eq("id", bid.id);
    if (acceptedBidError) {
      onMessage(`Could not accept bid: ${acceptedBidError.message}`);
      return;
    }

    const { error: projectError } = await supabase
      .from("projects")
      .update({ accepted_bid_id: bid.id, accepted_contractor_email: bid.contractor_email, status: "Bid Accepted" })
      .eq("id", project.id);

    if (projectError) {
      onMessage(`Could not update project: ${projectError.message}`);
      return;
    }

    const { data: contractData, error: contractError } = await supabase
      .from("contracts")
      .insert([{ project_id: project.id, bid_id: bid.id, owner_email: project.owner, contractor_email: bid.contractor_email, status: "pending_payment" }])
      .select();

    if (contractError) {
      onMessage(`Bid accepted, but contract was not created: ${contractError.message}`);
      return;
    }

    onMessage("Bid accepted. Contract created. Starting finalization payment.");
    await onBidSaved();
    startCheckout("finalization", { contractId: contractData?.[0]?.id || null, userId: user.id });
  }

  return (
    <Card className="overflow-hidden border border-slate-100">
      <div className="border-b bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300">{project.category}</p>
            <h3 className="mt-2 text-2xl font-bold">{project.title}</h3>
          </div>
          <span className="h-fit rounded-full bg-emerald-400/20 px-3 py-1 text-sm text-emerald-200">{project.status}</span>
        </div>
        <p className="mt-3 text-slate-300">{project.description}</p>
        <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>📍 {project.location}</div>
          <div>💵 {project.budget}</div>
          <div>🏢 {project.owner}</div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-950">Contractor bids</h4>
          <span className="text-sm text-slate-500">{bids.length} bid{bids.length === 1 ? "" : "s"}</span>
        </div>

        <div className="mt-4 space-y-3">
          {bids.length > 0 ? (
            bids.map((bid, index) => (
              <div key={`${bid.contractor_email || bid.company_name}-${index}`} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{bid.company_name || bid.contractor_email}</p>
                  <p className="mt-1 text-sm text-slate-500">Status: {bid.status}</p>
                  {bid.proposal ? <p className="mt-2 text-sm text-slate-600">{bid.proposal}</p> : null}
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <div className="flex gap-4 text-sm text-slate-700">
                    <span>{bid.bid_amount}</span>
                    <span>⏱ {bid.timeline}</span>
                  </div>
                  <AppButton onClick={() => acceptBid(bid)} className="bg-emerald-600 px-4 py-2 hover:bg-emerald-700">Accept Bid</AppButton>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No bids yet. Contractors can submit the first bid.</div>
          )}
        </div>

        <BidForm project={project} user={user} profile={profile} monthlyBidCount={monthlyBidCount} onMessage={onMessage} onBidSaved={onBidSaved} />
      </div>
    </Card>
  );
}

// =====================================================
// PROJECT POSTING
// Existing project creation retained.
// =====================================================
function ProjectOwnerPanel({ onAddProject, user }) {
  const [project, setProject] = useState({ title: "", location: "", budget: "", description: "" });

  function updateField(field, value) {
    setProject((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!project.title.trim() || !project.location.trim()) return;

    onAddProject({
      title: project.title.trim(),
      owner: user?.email || "Project Owner",
      location: project.location.trim(),
      budget: project.budget.trim() || "Budget to be confirmed",
      category: "New Project",
      description: project.description.trim() || "Project details will be added soon.",
      status: "Open"
    });

    setProject({ title: "", location: "", budget: "", description: "" });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-700">➕</div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">List a project</h3>
            <p className="text-sm text-slate-500">Post your project and receive competitive bids.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          <input value={project.title} onChange={(event) => updateField("title", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Project title" />
          <input value={project.location} onChange={(event) => updateField("location", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Location" />
          <input value={project.budget} onChange={(event) => updateField("budget", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Budget range" />
          <textarea value={project.description} onChange={(event) => updateField("description", event.target.value)} className="min-h-28 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Describe the scope, drawings, timeline, permits, and site conditions" />
          <AppButton type="submit" className="bg-blue-700 hover:bg-blue-800">Publish project</AppButton>
        </div>
      </form>
    </Card>
  );
}

// =====================================================
// CONTRACTOR PROFILE
// Existing profile retained and extended with tier awareness.
// =====================================================
function ContractorProfilePanel({ user, profile, onMessage, onProfileSaved }) {
  const [form, setForm] = useState({ company_name: "", expertise: "", years_experience: "", certifications: "", portfolio: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        company_name: profile.company_name || "",
        expertise: profile.expertise || "",
        years_experience: profile.years_experience || "",
        certifications: profile.certifications || "",
        portfolio: profile.portfolio || ""
      });
    }
  }, [profile]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;

    setLoading(true);

    const profileData = {
      id: user.id,
      email: user.email,
      role: "contractor",
      contractor_tier: profile?.contractor_tier || "free",
      company_name: form.company_name,
      expertise: form.expertise,
      years_experience: form.years_experience ? Number(form.years_experience) : null,
      certifications: form.certifications,
      portfolio: form.portfolio,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("profiles").upsert(profileData, { onConflict: "id" }).select();
    setLoading(false);

    if (error) {
      onMessage(`Could not save profile: ${error.message}`);
      return;
    }

    onMessage("Contractor profile saved successfully.");
    onProfileSaved();
  }

  const tier = PLATFORM_CONFIG.contractorTiers[profile?.contractor_tier || "free"] || DEFAULT_TIER;

  return (
    <Card>
      <form onSubmit={saveProfile} className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-2xl text-purple-700">👷</div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">Contractor profile</h3>
            <p className="text-sm text-slate-500">Current plan: {tier.name}. Badge: {tier.badge}.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          <input value={form.company_name} onChange={(event) => updateField("company_name", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Company name" />
          <input value={form.expertise} onChange={(event) => updateField("expertise", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Expertise, e.g. framing, plumbing, renovation" />
          <input type="number" value={form.years_experience} onChange={(event) => updateField("years_experience", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Years of experience" />
          <textarea value={form.certifications} onChange={(event) => updateField("certifications", event.target.value)} className="min-h-24 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Certifications, insurance, license information" />
          <textarea value={form.portfolio} onChange={(event) => updateField("portfolio", event.target.value)} className="min-h-28 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Past projects, references, portfolio notes" />
          <AppButton type="submit" className="bg-purple-700 hover:bg-purple-800">{loading ? "Saving..." : "Save contractor profile"}</AppButton>
        </div>
      </form>
    </Card>
  );
}

// =====================================================
// MAIN APP
// Existing Supabase data flow retained. Profile and bid counts added.
// =====================================================
function App() {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [monthlyBidCount, setMonthlyBidCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfessionalTools, setShowProfessionalTools] = useState(false);
  const [showLeadUnlock, setShowLeadUnlock] = useState(false);
  const [showPromotionTools, setShowPromotionTools] = useState(false);

  useEffect(() => {
    fetchProjects();
    getCurrentUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (nextUser) {
        fetchProfile(nextUser.id);
        fetchMonthlyBidCount(nextUser.id);
      } else {
        setProfile(null);
        setMonthlyBidCount(0);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (paymentStatus === "success") setMessage("Payment successful. Thank you.");
    if (paymentStatus === "cancelled") setMessage("Payment was cancelled.");
  }, []);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    const currentUser = data?.user || null;
    setUser(currentUser);
    if (currentUser) {
      await fetchProfile(currentUser.id);
      await fetchMonthlyBidCount(currentUser.id);
    }
    setAuthLoading(false);
  }

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!error) setProfile(data || null);
  }

  async function fetchMonthlyBidCount(userId) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", userId)
      .gte("created_at", startOfMonth.toISOString());

    if (!error) setMonthlyBidCount(count || 0);
  }

  async function fetchProjects() {
    const { data: projectData, error: projectError } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (projectError) {
      setMessage(`Supabase error: ${projectError.message}`);
      return;
    }

    const { data: bidData, error: bidError } = await supabase.from("bids").select("*").order("created_at", { ascending: false });
    if (bidError) {
      setMessage(`Bid loading error: ${bidError.message}`);
      return;
    }

    setProjects(projectData.map((project) => ({ ...project, bids: bidData.filter((bid) => bid.project_id === project.id) })));
  }

  const filteredProjects = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();
    if (!searchTerm) return projects;
    return projects.filter((project) => [project.title, project.location, project.category, project.description, project.owner].join(" ").toLowerCase().includes(searchTerm));
  }, [projects, query]);

  const totalBids = projects.reduce((sum, project) => sum + (project.bids || []).length, 0);

  async function handleAddProject(newProject) {
    if (!user) {
      setMessage("Please log in before listing a project.");
      return;
    }

    const { error } = await supabase.from("projects").insert([newProject]);
    if (error) {
      setMessage(`Could not save project: ${error.message}`);
      return;
    }

    await fetchProjects();
    setMessage("Project saved successfully.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setMonthlyBidCount(0);
    setMessage("You have logged out.");
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_white,_transparent_30%)] opacity-20" />
        <div className="relative mx-auto max-w-7xl px-6 py-8">
          <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white font-black text-slate-950">PB</div>
              <div>
                <p className="text-xl font-bold">ProjectBid</p>
                <p className="text-xs text-slate-400">Trusted project bidding for professionals</p>
              </div>
            </div>
            <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#projects" className="hover:text-white">Projects</a>
              <a href="#enroll" className="hover:text-white">Post</a>
              <a href="#profile" className="hover:text-white">Profile</a>
              <a href="#tools" className="hover:text-white">Tools</a>
            </div>
            {user ? <button onClick={handleLogout} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200">Logout</button> : <a href="#account" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200">Login</a>}
          </nav>

          <div className="grid items-center gap-12 py-16 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-slate-200">🏗 Projects, professionals, and trusted bids</p>
              <h1 className="mt-6 text-5xl font-black leading-tight md:text-6xl">Find the right professional for every project.</h1>
              <p className="mt-6 max-w-xl text-lg text-slate-300">Owners can post projects, compare qualified bids, review contractor profiles, and move toward a contract with confidence.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#enroll" className="rounded-2xl bg-emerald-500 px-7 py-3 text-center font-bold text-slate-950 hover:bg-emerald-600">Post a project</a>
                <a href="#projects" className="rounded-2xl border border-white/30 px-7 py-3 text-center font-bold text-white hover:bg-white hover:text-slate-950">Browse projects</a>
              </div>
            </div>

            <Card className="overflow-hidden border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
              <div className="grid gap-0 md:grid-cols-2">
                <div className="min-h-[340px] bg-[url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center" />
                <div className="p-6">
                  <div className="rounded-3xl bg-white p-5 text-slate-950">
                    <p className="text-sm text-slate-500">Marketplace workflow</p>
                    <p className="mt-2 text-3xl font-black">Post. Compare. Connect.</p>
                    <p className="mt-3 text-sm text-slate-600">A cleaner way to find qualified contractors and manage project bids.</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="rounded-3xl bg-slate-900 p-5"><p className="text-sm text-slate-400">Profiles</p><p className="text-3xl font-black">✓</p></div>
                    <div className="rounded-3xl bg-emerald-500 p-5 text-slate-950"><p className="text-sm text-slate-800">Bid review</p><p className="text-3xl font-black">✓</p></div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="relative z-10 -mt-20 grid gap-4 md:grid-cols-4">
          <StatCard emoji="🔨" label="Open projects" value={projects.length} />
          <StatCard emoji="📄" label="Active bids" value={totalBids} />
          <StatCard emoji="✅" label="Trust layer" value={profile?.is_verified ? "Verified" : "Optional"} />
          <StatCard emoji="⭐" label="Contractor tier" value={PLATFORM_CONFIG.contractorTiers[profile?.contractor_tier || "free"]?.badge || "Starter"} />
        </section>

        {message ? <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">{message}</div> : null}

        <section id="account" className="mt-12">
          {authLoading ? null : user ? <Card className="p-6"><p className="text-sm text-slate-500">Logged in as</p><p className="mt-1 font-bold text-slate-950">{user.email}</p></Card> : <AuthPanel onMessage={setMessage} />}
        </section>

        <section id="tools" className="mt-12 grid gap-5 lg:grid-cols-3">
          <Card className="p-6">
            <div className="text-3xl">✅</div>
            <h3 className="mt-4 text-xl font-black text-slate-950">Build trust</h3>
            <p className="mt-2 text-sm text-slate-600">Complete human verification only when ready for full marketplace access.</p>
            <div className="mt-5"><HumanVerificationPanel user={user} profile={profile} onMessage={setMessage} /></div>
          </Card>
          <Card className="p-6">
            <div className="text-3xl">👷</div>
            <h3 className="mt-4 text-xl font-black text-slate-950">Grow professionally</h3>
            <p className="mt-2 text-sm text-slate-600">Open advanced contractor tools only when you need more visibility or reach.</p>
            <AppButton onClick={() => setShowProfessionalTools((current) => !current)} className="mt-5">{showProfessionalTools ? "Hide tools" : "Explore tools"}</AppButton>
          </Card>
          <Card className="p-6">
            <div className="text-3xl">🔓</div>
            <h3 className="mt-4 text-xl font-black text-slate-950">Connect safely</h3>
            <p className="mt-2 text-sm text-slate-600">Unlock contact exchange only when both sides are ready.</p>
            <AppButton onClick={() => setShowLeadUnlock((current) => !current)} className="mt-5">{showLeadUnlock ? "Hide unlock" : "Open unlock"}</AppButton>
          </Card>
        </section>

        {showLeadUnlock ? <section className="mt-8"><LeadUnlockPanel user={user} onMessage={setMessage} /></section> : null}
        {showProfessionalTools ? <ContractorTiersPanel user={user} profile={profile} onMessage={setMessage} /> : null}

        <section id="projects" className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <SectionHeader eyebrow="Marketplace" title="Available projects" description="Browse active project opportunities and compare bids from professionals." />
              <div className="relative"><span className="absolute left-4 top-3 text-slate-400">🔎</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 min-w-[280px] rounded-2xl border bg-white pl-11 pr-4 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Search projects" /></div>
            </div>
            <div className="grid gap-6">
              {filteredProjects.length > 0 ? filteredProjects.map((project) => <ProjectCard key={project.id} project={project} user={user} profile={profile} monthlyBidCount={monthlyBidCount} onMessage={setMessage} onBidSaved={() => { fetchProjects(); if (user) fetchMonthlyBidCount(user.id); }} />) : <Card className="p-8 text-center text-slate-600">No projects match your search.</Card>}
            </div>
          </div>

          <aside className="space-y-5">
            <Card className="overflow-hidden">
              <div className="h-44 bg-[url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center" />
              <div className="p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Visibility</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">Promote when needed</h3>
                <p className="mt-2 text-sm text-slate-600">Open featured listings and ads only when you want extra exposure.</p>
                <AppButton onClick={() => setShowPromotionTools((current) => !current)} className="mt-5">{showPromotionTools ? "Hide promotion" : "Show promotion"}</AppButton>
              </div>
            </Card>
            {showPromotionTools ? <><PromotionPanel title="Featured listings" description="Appear first in search, on the homepage, or in selected cities and categories." options={PLATFORM_CONFIG.featuredListings} user={user} onMessage={setMessage} /><PromotionPanel title="Paid advertisements" description="Purchase ad placement on homepage, contractor dashboard, and project detail pages." options={PLATFORM_CONFIG.advertisements} user={user} onMessage={setMessage} /></> : null}
          </aside>
        </section>

        <section id="enroll" className="mt-14 grid gap-8 lg:grid-cols-2">
          {user ? <ProjectOwnerPanel onAddProject={handleAddProject} user={user} /> : <AuthPanel onMessage={setMessage} />}
          {user ? <ContractorProfilePanel user={user} profile={profile} onMessage={setMessage} onProfileSaved={() => fetchProfile(user.id)} /> : null}
        </section>
      </main>
    </div>
  );
}

export default App;
