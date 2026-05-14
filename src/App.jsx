import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

async function startCheckout(paymentType) {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ paymentType })
  });

  const data = await response.json();

  if (data.url) {
    window.location.href = data.url;
  } else {
    alert(data.error || "Payment could not start.");
  }
}

const paidAds = [
  {
    company: "Premium Stone & Tile",
    title: "Luxury tile supply for builders",
    text: "Advertise construction products directly to project owners and contractors.",
    price: "$49/week"
  },
  {
    company: "Island Tool Rentals",
    title: "Contractor equipment rentals",
    text: "Reach verified contractors looking for tools, lifts, trailers, and site equipment.",
    price: "$99/month"
  }
];

function AppButton({ children, className = "", type = "button", onClick, variant = "solid" }) {
  const variantClass =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
      : "bg-slate-950 text-white hover:bg-slate-800";

  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${variantClass} ${className}`}
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
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-2xl text-white">
          {emoji}
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </Card>
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
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role
          }
        }
      });

      if (error) {
        onMessage(`Signup error: ${error.message}`);
      } else {
        onMessage("Signup successful. You are now signed in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        onMessage(`Login error: ${error.message}`);
      } else {
        onMessage("Login successful.");
      }
    }

    setLoading(false);
  }

  return (
    <Card>
      <form onSubmit={handleAuth} className="p-6">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Account</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">
            {mode === "signup" ? "Create your account" : "Log in to continue"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Users must log in before listing projects or later submitting bids.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Email address"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Password"
          />

          {mode === "signup" ? (
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="project_owner">Project Owner</option>
              <option value="contractor">Contractor</option>
            </select>
          ) : null}

          <AppButton type="submit" className="bg-emerald-600 hover:bg-emerald-700">
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
          </AppButton>

          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-sm font-semibold text-slate-700 hover:text-slate-950"
          >
            {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function BidForm({ project, user, onMessage, onBidSaved }) {
  const [bidAmount, setBidAmount] = useState("");
  const [timeline, setTimeline] = useState("");
  const [proposal, setProposal] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitBid(event) {
    event.preventDefault();

    if (!user) {
      onMessage("Please log in before submitting a bid.");
      return;
    }

    if (!bidAmount.trim() || !timeline.trim()) {
      onMessage("Please enter a bid amount and timeline.");
      return;
    }

    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name")
      .eq("id", user.id)
      .maybeSingle();

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
      <h5 className="font-bold text-slate-950">Submit your bid</h5>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} className="rounded-2xl border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Bid amount, e.g. $42,500" />
        <input value={timeline} onChange={(event) => setTimeline(event.target.value)} className="rounded-2xl border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Timeline, e.g. 8 weeks" />
      </div>
      <textarea value={proposal} onChange={(event) => setProposal(event.target.value)} className="mt-3 min-h-24 w-full rounded-2xl border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Proposal details, experience, materials, exclusions, warranty, and notes" />
      <AppButton type="submit" className="mt-3 bg-blue-700 hover:bg-blue-800">
        {loading ? "Submitting..." : "Submit bid"}
      </AppButton>
    </form>
  );
}

function ProjectCard({ project, user, onMessage, onBidSaved }) {
  const bids = project.bids || [];

  async function acceptBid(bid) {
    if (!user) {
      onMessage("Please log in before accepting a bid.");
      return;
    }

    const { error: bidError } = await supabase
      .from("bids")
      .update({ status: "rejected" })
      .eq("project_id", project.id);

    if (bidError) {
      onMessage(`Could not update other bids: ${bidError.message}`);
      return;
    }

    const { error: acceptedBidError } = await supabase
      .from("bids")
      .update({ status: "accepted" })
      .eq("id", bid.id);

    if (acceptedBidError) {
      onMessage(`Could not accept bid: ${acceptedBidError.message}`);
      return;
    }

    const { error: projectError } = await supabase
      .from("projects")
      .update({
        accepted_bid_id: bid.id,
        accepted_contractor_email: bid.contractor_email,
        status: "Bid Accepted"
      })
      .eq("id", project.id);

    if (projectError) {
      onMessage(`Could not update project: ${projectError.message}`);
      return;
    }

    const { error: contractError } = await supabase.from("contracts").insert([
      {
        project_id: project.id,
        bid_id: bid.id,
        owner_email: project.owner,
        contractor_email: bid.contractor_email,
        status: "pending_payment"
      }
    ]);

    if (contractError) {
      onMessage(`Bid accepted, but contract was not created: ${contractError.message}`);
      return;
    }

    onMessage("Bid accepted. Contract created. Starting finalization payment.");
    await onBidSaved();
    startCheckout("finalization");
  }

  function handleFinalizePayment() {
    onMessage(`Starting payment for ${project.title}. Stripe Checkout will collect the contract finalization fee.`);
    startCheckout("finalization");
  }

  return (
    <Card className="overflow-hidden border border-slate-100">
      <div className="border-b bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300">{project.category}</p>
            <h3 className="mt-2 text-2xl font-bold">{project.title}</h3>
          </div>
          <span className="h-fit rounded-full bg-emerald-400/20 px-3 py-1 text-sm text-emerald-200">
            {project.status}
          </span>
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
          <span className="text-sm text-slate-500">
            {bids.length} bid{bids.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {bids.length > 0 ? (
            bids.map((bid, index) => (
              <div
                key={`${bid.contractor}-${index}`}
                className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{bid.company_name || bid.contractor || bid.contractor_email}</p>
                  <p className="mt-1 text-sm text-slate-500">{bid.status ? `Status: ${bid.status}` : `⭐ ${bid.rating} rating`}</p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <div className="flex gap-4 text-sm text-slate-700">
                    <span>{bid.bid_amount || bid.amount}</span>
                    <span>⏱ {bid.timeline}</span>
                  </div>
                  <AppButton onClick={() => acceptBid(bid)} className="bg-emerald-600 px-4 py-2 hover:bg-emerald-700">
                    Accept Bid
                  </AppButton>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              No bids yet. Contractors can submit the first bid.
            </div>
          )}
        </div>

        <BidForm project={project} user={user} onMessage={onMessage} onBidSaved={onBidSaved} />

        <div className="mt-5 grid gap-3 sm:grid-cols-1">
          <AppButton onClick={handleFinalizePayment} className="bg-emerald-600 hover:bg-emerald-700">
            Finalize contract: $5 + $5
          </AppButton>
        </div>
      </div>
    </Card>
  );
}

function ProjectOwnerPanel({ onAddProject, user }) {
  const [project, setProject] = useState({
    title: "",
    location: "",
    budget: "",
    description: ""
  });

  function updateField(field, value) {
    setProject((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!project.title.trim() || !project.location.trim()) {
      return;
    }

    onAddProject({
      title: project.title.trim(),
      owner: user?.email || "Project Owner",
      location: project.location.trim(),
      budget: project.budget.trim() || "Budget to be confirmed",
      category: "New Project",
      description: project.description.trim() || "Project details will be added soon.",
      bids: [],
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
            <p className="text-sm text-slate-500">Owners can post work and receive competitive bids.</p>
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

function ContractorProfilePanel({ user, onMessage }) {
  const [profile, setProfile] = useState({
    company_name: "",
    expertise: "",
    years_experience: "",
    certifications: "",
    portfolio: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  async function fetchProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      onMessage(`Could not load profile: ${error.message}`);
      return;
    }

    if (data) {
      setProfile({
        company_name: data.company_name || "",
        expertise: data.expertise || "",
        years_experience: data.years_experience || "",
        certifications: data.certifications || "",
        portfolio: data.portfolio || ""
      });
    }
  }

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!user) {
      onMessage("Please log in before creating a contractor profile.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      role: "contractor",
      company_name: profile.company_name,
      expertise: profile.expertise,
      years_experience: profile.years_experience ? Number(profile.years_experience) : null,
      certifications: profile.certifications,
      portfolio: profile.portfolio,
      updated_at: new Date().toISOString()
    });

    setLoading(false);

    if (error) {
      onMessage(`Could not save profile: ${error.message}`);
      return;
    }

    onMessage("Contractor profile saved successfully.");
  }

  return (
    <Card>
      <form onSubmit={saveProfile} className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-2xl text-purple-700">👷</div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">Contractor profile</h3>
            <p className="text-sm text-slate-500">Add your company details, expertise, and past work.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <input value={profile.company_name} onChange={(event) => updateField("company_name", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Company name" />
          <input value={profile.expertise} onChange={(event) => updateField("expertise", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Expertise, e.g. framing, plumbing, renovation" />
          <input type="number" value={profile.years_experience} onChange={(event) => updateField("years_experience", event.target.value)} className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Years of experience" />
          <textarea value={profile.certifications} onChange={(event) => updateField("certifications", event.target.value)} className="min-h-24 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Certifications, insurance, license information" />
          <textarea value={profile.portfolio} onChange={(event) => updateField("portfolio", event.target.value)} className="min-h-28 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Past projects, references, portfolio notes" />
          <AppButton type="submit" className="bg-purple-700 hover:bg-purple-800">
            {loading ? "Saving..." : "Save contractor profile"}
          </AppButton>
        </div>
      </form>
    </Card>
  );
}

function EnrollmentPanel({ onVerify, user }) {
  function handleVerificationPayment() {
    if (!user) {
      onVerify();
      return;
    }

    onVerify();
    startCheckout("verification");
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✅</div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">Contractor enrollment</h3>
            <p className="text-sm text-slate-500">Verify real users with a $1 card payment.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <input className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Company name" />
          <input className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Trade expertise, e.g. framing, plumbing, renovation" />
          <textarea className="min-h-28 rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Past projects, certifications, insurance, photos, and references" />
          <AppButton onClick={handleVerificationPayment}>💳 Pay $1 and verify enrollment</AppButton>
        </div>
      </div>
    </Card>
  );
}

function AdCard({ ad }) {
  return (
    <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-lg">
      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">📣 Sponsored</div>
        <h4 className="mt-3 text-lg font-bold text-slate-950">{ad.title}</h4>
        <p className="mt-1 text-sm text-slate-500">{ad.company}</p>
        <p className="mt-3 text-slate-700">{ad.text}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-bold text-slate-950">{ad.price}</span>
          <AppButton variant="outline" onClick={() => startCheckout("advertisement")}>Advertise</AppButton>
        </div>
      </div>
    </Card>
  );
}

export default function ProjectBidMarketplaceApp() {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
    getCurrentUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");

    if (paymentStatus === "success") {
      setMessage("Payment successful. Thank you.");
    }

    if (paymentStatus === "cancelled") {
      setMessage("Payment was cancelled.");
    }
  }, []);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data?.user || null);
    setAuthLoading(false);
  }

  async function fetchProjects() {
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (projectError) {
      console.error(projectError);
      setMessage(`Supabase error: ${projectError.message}`);
      return;
    }

    const { data: bidData, error: bidError } = await supabase
      .from("bids")
      .select("*")
      .order("created_at", { ascending: false });

    if (bidError) {
      console.error(bidError);
      setMessage(`Bid loading error: ${bidError.message}`);
      return;
    }

    const projectsWithBids = projectData.map((project) => ({
      ...project,
      bids: bidData.filter((bid) => bid.project_id === project.id)
    }));

    setProjects(projectsWithBids);
  }

  const filteredProjects = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm) {
      return projects;
    }

    return projects.filter((project) => {
      const searchableText = [project.title, project.location, project.category, project.description, project.owner]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });
  }, [projects, query]);

  const totalBids = projects.reduce((sum, project) => sum + (project.bids || []).length, 0);

  async function handleAddProject(newProject) {
    if (!user) {
      setMessage("Please log in before listing a project.");
      return;
    }

    const { error } = await supabase.from("projects").insert([
      {
        title: newProject.title,
        owner: newProject.owner,
        location: newProject.location,
        budget: newProject.budget,
        category: newProject.category,
        description: newProject.description,
        status: newProject.status
      }
    ]);

    if (error) {
      console.error(error);
      setMessage(`Could not save project: ${error.message}`);
      return;
    }

    await fetchProjects();
    setMessage("Project saved to Supabase successfully.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setMessage("You have logged out.");
  }

  function handleVerify() {
    if (!user) {
      setMessage("Please log in before contractor verification.");
      return;
    }

    setMessage("Starting $1 contractor verification payment.");
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
                <p className="text-xs text-slate-400">Verified construction bidding marketplace</p>
              </div>
            </div>

            <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#projects" className="hover:text-white">Projects</a>
              <a href="#enroll" className="hover:text-white">Enroll</a>
              <a href="#advertise" className="hover:text-white">Advertise</a>
            </div>

            {user ? (
              <button onClick={handleLogout} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200">
                Logout
              </button>
            ) : (
              <a href="#account" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200">Login</a>
            )}
          </nav>

          <div className="grid items-center gap-12 py-16 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-slate-200">🛡 $1 verification. $5 + $5 contract finalization fee.</p>
              <h1 className="mt-6 text-5xl font-black leading-tight md:text-6xl">Find trusted contractors. Bid smarter. Finalize safely.</h1>
              <p className="mt-6 max-w-xl text-lg text-slate-300">A premium marketplace where project owners post construction work, verified contractors bid, and both sides pay a small platform fee before finalizing the contract.</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#enroll" className="rounded-2xl bg-emerald-500 px-7 py-3 text-center font-bold text-slate-950 hover:bg-emerald-600">List a project</a>
                <a href="#enroll" className="rounded-2xl border border-white/30 px-7 py-3 text-center font-bold text-white hover:bg-white hover:text-slate-950">Enroll as contractor</a>
              </div>
            </div>

            <Card className="border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
              <div className="p-6">
                <div className="grid gap-4">
                  <div className="rounded-3xl bg-white p-5 text-slate-950">
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-500">Live marketplace value</p>
                        <p className="text-3xl font-black">$412,000</p>
                      </div>
                      <div className="text-3xl">🔨</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-3xl bg-slate-900 p-5">
                      <p className="text-sm text-slate-400">Verified contractors</p>
                      <p className="text-3xl font-black">128</p>
                    </div>
                    <div className="rounded-3xl bg-emerald-500 p-5 text-slate-950">
                      <p className="text-sm text-slate-800">Platform fees</p>
                      <p className="text-3xl font-black">$1 + $10</p>
                    </div>
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
          <StatCard emoji="✅" label="Verified users" value="312" />
          <StatCard emoji="💳" label="Verification fee" value="$1" />
          <StatCard emoji="📄" label="Active bids" value={totalBids} />
        </section>

        {message ? <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">{message}</div> : null}

        <section id="account" className="mt-12">
          {authLoading ? null : user ? (
            <Card className="p-6">
              <p className="text-sm text-slate-500">Logged in as</p>
              <p className="mt-1 font-bold text-slate-950">{user.email}</p>
            </Card>
          ) : (
            <AuthPanel onMessage={setMessage} />
          )}
        </section>

        <section id="projects" className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Marketplace</p>
                <h2 className="text-4xl font-black text-slate-950">Available projects</h2>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400">🔎</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 min-w-[280px] rounded-2xl border bg-white pl-11 pr-4 outline-none focus:ring-2 focus:ring-slate-900" placeholder="Search projects" />
              </div>
            </div>

            <div className="grid gap-6">
              {filteredProjects.length > 0 ? filteredProjects.map((project) => <ProjectCard key={project.id} project={project} user={user} onMessage={setMessage} onBidSaved={fetchProjects} />) : <Card className="p-8 text-center text-slate-600">No projects match your search.</Card>}
            </div>
          </div>

          <aside id="advertise" className="space-y-5">
            <Card className="bg-slate-950 text-white">
              <div className="p-6">
                <div className="text-3xl text-amber-300">📣</div>
                <h3 className="mt-4 text-2xl font-black">Paid advertising</h3>
                <p className="mt-2 text-slate-300">Suppliers, lenders, designers, trades, and service companies can promote offers inside the marketplace.</p>
                <AppButton onClick={() => startCheckout("advertisement")} className="mt-5 bg-amber-300 text-slate-950 hover:bg-amber-200">Create ad campaign</AppButton>
              </div>
            </Card>

            {paidAds.map((ad) => <AdCard key={ad.company} ad={ad} />)}
          </aside>
        </section>

        <section id="enroll" className="mt-14 grid gap-8 lg:grid-cols-2">
          {user ? <ProjectOwnerPanel onAddProject={handleAddProject} user={user} /> : <AuthPanel onMessage={setMessage} />}
          <EnrollmentPanel onVerify={handleVerify} user={user} />
        </section>

        <section id="contractor-profile" className="mt-14">
          {user ? <ContractorProfilePanel user={user} onMessage={setMessage} /> : null}
        </section>

        <section className="mt-14 rounded-[2rem] bg-white p-8 shadow-xl">
          <h2 className="text-3xl font-black">Payment logic for production</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-3xl">💳</div>
              <h3 className="mt-3 font-bold">$1 enrollment verification</h3>
              <p className="mt-2 text-sm text-slate-600">Contractors and project owners pay $1 by card when registering to reduce fake accounts.</p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-3xl">✅</div>
              <h3 className="mt-3 font-bold">$5 finalization fee</h3>
              <p className="mt-2 text-sm text-slate-600">When a bid is accepted, collect $5 from the project owner and $5 from the contractor before enabling contract finalization.</p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-3xl">📣</div>
              <h3 className="mt-3 font-bold">Paid advertisements</h3>
              <p className="mt-2 text-sm text-slate-600">Businesses can purchase weekly or monthly ad placements inside the app.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
