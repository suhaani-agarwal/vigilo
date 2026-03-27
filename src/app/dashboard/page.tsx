"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TestTube, Bell, Settings, Calendar, FileText, ChevronRight, AlertTriangle, CheckCircle, X, Filter, Search, MessageCircle, Send } from 'lucide-react';

// Expose backend base for client links (safe in client bundle)
const FRONT_API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5005';

type CompliancePlan = {
  timeline?: {
    timeframe: string;
    actions: {
      department: string;
      task: string;
      steps?: string[];
      urgency?: string;
      amendments?: string[];
      deadline?: string;
      currentLabel?: string; 
      requiredLabel?: string;
      labelRequirements?: string[];
      currentIssues?: string[];
      productComposition?: string;
    }[];
  }[];
  summary?: {
    critical_items?: number;
    high_priority?: number;
    total_actions?: number;
    compliance_score?: number;
  };
  status?: string;
  notes?: string;
  next_steps?: string[];
};
// Hardcoded Chicory Labels Compliance Card (always shown at top)
const ChicoryLabelsCard = () => (
  <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6 relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(600px 200px at 10% -10%, rgba(16,185,129,0.08), transparent)' }} />
    <div className="flex items-center justify-between mb-4 relative">
      <h2 className="text-xl font-semibold text-white">Critical Packaging: Chicory Label Compliance</h2>
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300">Critical</span>
    </div>
    <p className="text-sm text-gray-300 mb-4">Front-panel declaration for coffee-chicory blends is mandatory. The current label fails to prominently disclose the blend and percentage breakdown. Immediate artwork correction is required.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div className="text-xs text-gray-500 mb-2">Current Label</div>
        <img src="/current-label.png" alt="Current label" className="rounded border border-gray-700 w-full h-auto" />
        <ul className="mt-3 space-y-1 text-xs text-red-400">
          <li className="flex gap-1"><X className="h-3 w-3 mt-0.5" /> Missing mandatory declaration</li>
          <li className="flex gap-1"><X className="h-3 w-3 mt-0.5" /> No percentage of coffee vs. chicory</li>
          <li className="flex gap-1"><X className="h-3 w-3 mt-0.5" /> Font size and contrast inadequate</li>
        </ul>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-2">Required Label</div>
        <img src="/required-label.png" alt="Required label" className="rounded border border-gray-700 w-full h-auto" />
        <ul className="mt-3 space-y-1 text-xs text-emerald-400">
          <li className="flex gap-1"><CheckCircle className="h-3 w-3 mt-0.5" /> “COFFEE BLENDED WITH CHICORY” on front panel</li>
          <li className="flex gap-1"><CheckCircle className="h-3 w-3 mt-0.5" /> Percentage breakdown clearly stated</li>
          <li className="flex gap-1"><CheckCircle className="h-3 w-3 mt-0.5" /> Minimum 3mm font, high contrast</li>
        </ul>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-sm">
        <div className="text-red-300 text-xs mb-1">Risk</div>
        Misbranding and consumer deception; potential recall exposure.
      </div>
      <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/20 text-sm">
        <div className="text-yellow-300 text-xs mb-1">Immediate Actions</div>
        Update artwork, add declaration & percentages, route for regulatory sign-off.
      </div>
      <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-sm">
        <div className="text-emerald-300 text-xs mb-1">Outcome</div>
        Clear consumer information; robust compliance posture for packaging audits.
      </div>
    </div>
  </div>
);

  // Helpers
  const safeFormatDate = (d?: string) => {
    if (!d || d === 'Unknown') return 'Unknown';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d; // show raw if not ISO
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Detailed finding card from Stage 5 by_amendment
  const FindingCard = ({ finding }: { finding: any }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">{finding.amendment_title}</h3>
        <div className="flex items-center gap-2">
          {finding.last_date && (
            <span className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {safeFormatDate(finding.last_date)}
            </span>
          )}
          {!finding.last_date && finding.deadline_text && (
            <span className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {finding.deadline_text}
            </span>
          )}
          {finding.urgency && (
            <span className={`px-2 py-0.5 text-xs rounded ${
              finding.urgency === 'Critical' ? 'bg-red-500/20 text-red-300' :
              finding.urgency === 'High' ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-gray-700 text-gray-300'
            }`}>
              {finding.urgency}
            </span>
          )}
        </div>
      </div>
      {finding.current_state && (
        <p className="text-sm text-gray-300 mb-4">{finding.current_state}</p>
      )}
      {finding.evidence?.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">EVIDENCE</div>
          <ul className="space-y-2">
            {finding.evidence.map((e: string, i: number) => (
              <li key={i} className="text-sm text-gray-300">“{e}”</li>
            ))}
          </ul>
        </div>
      )}
      {finding.gaps?.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">GAPS</div>
          <ul className="space-y-1.5">
            {finding.gaps.map((g: string, i: number) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2"><span className="text-gray-600">•</span>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {finding.actions?.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 mb-2">ACTIONS TO COMPLY</div>
          <ul className="space-y-1.5">
            {finding.actions.map((a: string, i: number) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2"><span className="text-gray-600">•</span>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {(finding.document_id || finding.pdf_url) && (
        <div className="mt-4">
          <a
            href={finding.pdf_url || `${FRONT_API_BASE}/pdf?document_id=${encodeURIComponent(finding.document_id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <FileText className="h-4 w-4" /> View full regulation document
          </a>
        </div>
      )}
    </div>
  );

type Analysis = {
  analysis_steps?: Record<string, string[]>;
  initial_amendments?: number;
  relevant_amendments?: number;
  compliance_plan?: CompliancePlan;
  detailed_amendments?: any[];
  findings?: any[]; // from Stage 5 by_amendment with full details
};

type MetaItem = {
  title: string;
  date: string;
  source?: string;
  pdf_url?: string;
  pdf_path?: string;
  document_id?: string;
};

export default function DashboardPage() {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5005';
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [introLoading, setIntroLoading] = useState(true);
  const [amendments, setAmendments] = useState<MetaItem[]>([]);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [notifications, setNotifications] = useState<{id: string; message: string; type: 'alert' | 'update'}[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing compliance dashboard...");
  const [selectedTimeline, setSelectedTimeline] = useState<{timeframe: string; actions: any[]} | null>(null);

  // Load company ID and initial data
  useEffect(() => {
    try {
      const cid = localStorage.getItem('company_id');
      if (cid) setCompanyId(cid);
    } catch {}

    // Simulate incoming notifications
    const notificationTimer = setTimeout(() => {
      setNotifications([
        {
          id: '1',
          message: 'FSSAI just released new packaging amendment (2025/08/15)',
          type: 'update'
        },
        {
          id: '2',
          message: '3 compliance actions pending from last month',
          type: 'alert'
        }
      ]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== '1'));
      }, 5000);
    }, 3000);

    return () => clearTimeout(notificationTimer);
  }, []);

// Load amendments from backend

useEffect(() => {
  const loadAmendments = async () => {
    const loadingMessages = [
      "Initializing compliance dashboard...",
      "Checking for regulatory updates...",
      "Scanning FSSAI notifications...",
      "Scanning DGFT trade notifications...",
      "Scanning GST tax regulations...",
      "Analyzing your company profile...",
      "Cross-referencing regulations with your docs...",
      "Filtering relevant amendments...",
      "Loading personalized compliance data..."
    ];

    // Simulate loading with dynamic messages
    for (let i = 0; i < loadingMessages.length; i++) {
      setLoadingMessage(loadingMessages[i]);
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 2500 : 1500));
    }

    try {
      // First, trigger scraping for all sources to ensure we have the latest data
      const scrapePromises = [
        fetch(`${API_BASE}/update`).then(res => res.ok ? res.json() : null),
        fetch(`${API_BASE}/update-dgft`).then(res => res.ok ? res.json() : null),
        fetch(`${API_BASE}/update-gst`).then(res => res.ok ? res.json() : null)
      ];

      // Wait for scraping to complete (or at least start)
      await Promise.allSettled(scrapePromises);
      
      // Now fetch the curated latest relevant amendments (AI-filtered)
      const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
      const res = await fetch(`${API_BASE}/latest-relevant${query}`);
      
      let allAmendments: MetaItem[] = [];
      if (res.ok) {
        const payload = await res.json();
        console.debug("/latest-relevant raw response:", payload);

        if (Array.isArray(payload)) {
          allAmendments = payload;
        } else if (payload && typeof payload === 'object') {
          // Merge lists from each source preserving source info
          const merged: MetaItem[] = [];
          for (const key of ['FSSAI', 'DGFT', 'GST']) {
            const list = payload[key];
            if (Array.isArray(list)) {
              list.forEach((it: any) => {
                try { if (!it.source) it.source = key; } catch(e) {}
                merged.push(it as MetaItem);
              });
            }
          }
          allAmendments = merged;
        }
      }

      // Sort by date (most recent first)
      allAmendments.sort((a, b) => {
        const dateA = (!a || !a.date || a.date === 'Unknown') ? new Date(0) : new Date(a.date);
        const dateB = (!b || !b.date || b.date === 'Unknown') ? new Date(0) : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });

      setAmendments(allAmendments.slice(0, 35));
      
      setTimeout(() => {
        setNotifications(prev => [
          ...prev,
          {
            id: 'dashboard-loaded',
            message: `Dashboard loaded! Found ${allAmendments.length} curated regulatory amendments`,
            type: 'update'
          }
        ]);
      }, 2000);
      
    } catch (err) {
      console.error("Failed to load amendments:", err);
      // Fallback: try to load without scraping if scraping failed
      try {
        const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
        const res = await fetch(`${API_BASE}/latest-relevant${query}`);
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload)) {
            setAmendments(payload.slice(0, 35));
          }
        }
      } catch (fallbackErr) {
        console.error("Fallback loading also failed:", fallbackErr);
      }
    }
    
    setPageLoading(false);
    setIntroLoading(false);
  };
  
  loadAmendments();
}, [API_BASE, companyId]);


  const filteredAmendments = useMemo(() => {
    return amendments.filter(amendment => {
      const matchesSearch = amendment.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === "all" || 
                          (filter === "critical" && amendment.title.toLowerCase().includes("coffee")) ||
                          (filter === "recent" && amendment.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      return matchesSearch && matchesFilter;
    });
  }, [amendments, searchTerm, filter]);

  const runCompliance = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setActiveStep(-1);

    // Step ticker: keep animating steps while the backend runs
    const steps = [
      'Analyzing latest FSSAI amendments...',
      'Cross-referencing with your product portfolio...',
      'Evaluating packaging and labeling compliance...',
      'Assessing required documentation updates...',
      'Generating actionable compliance plan...'
    ];
    let stepIndex = 0;
    setActiveStep(stepIndex);
    setProgress(steps[stepIndex]);
    const stepTimer = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setActiveStep(stepIndex);
      setProgress(steps[stepIndex]);
    }, 1800);

    try {
      // Get latest company if not present
      let cid = companyId;
      if (!cid) {
        const res = await fetch(`${API_BASE}/company/latest`);
        if (!res.ok) throw new Error('No latest company found. Please submit your company details first.');
        const latest = await res.json();
        cid = latest.company_id as string;
        setCompanyId(cid);
        try { localStorage.setItem('company_id', cid); } catch {}
      }

      // Run real compliance chain
      const runRes = await fetch(`${API_BASE}/compliance/check?company_id=${encodeURIComponent(cid!)}`);
      if (!runRes.ok) {
        const err = await runRes.json().catch(() => ({}));
        throw new Error(err?.detail || 'Compliance check failed');
      }
      const payload = await runRes.json();
      const result = payload.result;

      // Map backend Stage 5 report to UI model
      const report = result?.final_report?.compliance_report || {};
      const byAmendment = (report.by_amendment || []) as any[];
      const prioritized = (report.prioritized_actions || []) as any[];

      // Build timeline sections: prefer backend-provided consolidated timeline if available
      const reportTimeline = (report.timeline || []) as any[];
      let timelineSections: { timeframe: string; actions: any[] }[] = [];
      if (Array.isArray(reportTimeline) && reportTimeline.length) {
        timelineSections = reportTimeline.map((slot: any) => ({
          timeframe: slot.timeframe || 'Upcoming',
          actions: (slot.actions || []).map((a: any) => ({
            department: a.department || 'General',
            task: a.task || 'Action',
            steps: a.steps,
            urgency: a.urgency,
            amendments: a.amendments,
            deadline: a.due || a.deadline || a.last_date || 'Unknown',
          }))
        })).filter(s => s.actions.length > 0);
      } else {
        // Fallback to building from prioritized actions
        const timelineActions = prioritized.map((a: any) => ({
          department: a.department || 'General',
          task: a.task || 'Action',
          steps: undefined,
          urgency: a.urgency,
          amendments: undefined,
          deadline: a.due || 'Unknown'
        }));

        // Preserve chicory label comparison if relevant
        const hasChicory = byAmendment.some(a => (a.amendment_title || '').toLowerCase().includes('chicory') || (a.amendment_title || '').toLowerCase().includes('coffee'));
        if (hasChicory) {
          timelineActions.unshift({
            department: 'Packaging Design',
            task: 'Update coffee product labels for chicory declaration',
            steps: [
              'Update front panel layout with mandatory declaration',
              'Verify minimum font size and contrast',
              'Route artwork for regulatory approval'
            ],
            urgency: 'Critical',
            amendments: [
              byAmendment.find(a => (a.amendment_title || '').toLowerCase().includes('chicory') || (a.amendment_title || '').toLowerCase().includes('coffee'))?.amendment_title || 'Coffee/Chicory Labeling'
            ],
            deadline: 'Unknown',
            currentLabel: '/current-label.png',
            requiredLabel: '/required-label.png',
            labelRequirements: [
              "Show 'COFFEE BLENDED WITH CHICORY' prominently",
              'Include percentage breakdown of coffee/chicory',
              'Minimum 3mm font size for declaration',
              'High contrast text for readability'
            ],
            currentIssues: [
              'Missing mandatory declaration text',
              'No percentage breakdown shown',
              'Imagery could be misleading about contents'
            ],
            productComposition: undefined
          } as any);
        }

        timelineSections = [
          { timeframe: 'Immediate (1-2 weeks)', actions: timelineActions.slice(0, Math.min(3, timelineActions.length)) },
          { timeframe: 'Short-term (3-4 weeks)', actions: timelineActions.slice(3, 6) },
          { timeframe: 'Ongoing', actions: timelineActions.slice(6) }
        ].filter(slot => slot.actions.length > 0);
      }

      const compliancePlan: CompliancePlan = {
        timeline: timelineSections,
        summary: {
          critical_items: (timelineSections.flatMap(s => s.actions).filter(a => a.urgency === 'Critical')).length,
          high_priority: (timelineSections.flatMap(s => s.actions).filter(a => a.urgency === 'High')).length,
          total_actions: timelineSections.flatMap(s => s.actions).length,
          compliance_score: report.overall_status === 'compliant' ? 95 : report.overall_status === 'partially_compliant' ? 75 : report.overall_status === 'unclear' ? 60 : 50
        },
        status: report.overall_status === 'compliant' ? 'compliant' : 'requires_action',
        notes: 'Generated from Stage 5 compliance report',
        next_steps: (report.summary ? [report.summary] : [])
      };

      // Prepare findings (keep full details to render evidence-rich cards)
      const findings = byAmendment.map((a: any) => ({
        amendment_title: a.amendment_title,
        status: a.status,
        current_state: a.current_state,
        to_be_done: a.to_be_done,
        evidence: Array.isArray(a.evidence) ? a.evidence : [],
        gaps: Array.isArray(a.gaps) ? a.gaps : [],
        actions: Array.isArray(a.actions) ? a.actions : [],
        last_date: a.last_date || a.normalized_last_date || a.deadline || a.due || 'Unknown',
        deadline_text: a.deadline_text,
        urgency: a.urgency || 'Medium',
        document_id: a.document_id || a?.meta?.document_id,
        pdf_url: a.pdf_url,
      }));

      // Also keep a lighter list for the Amendments section (optional)
      const detailedAmendments = byAmendment.map((a: any) => ({
        title: a.amendment_title,
        date: a.last_date || a.normalized_last_date || a.deadline || a.due || 'Unknown',
        summary: a.current_state,
        requirements: Array.isArray(a.actions) ? a.actions : [],
        relevance_reason: a.to_be_done,
        product_impacts: [],
        document_id: a.document_id || a?.meta?.document_id,
        pdf_url: a.pdf_url,
      }));

      const nextAnalysis = {
        analysis_steps: result?.analysis_steps || {},
        initial_amendments: result?.amendments_count || amendments.length,
        relevant_amendments: byAmendment.length,
        compliance_plan: compliancePlan,
        detailed_amendments: detailedAmendments,
        findings
      } as Analysis;
      setAnalysis(nextAnalysis);
      // Auto-select first available timeline slot so sidebar renders immediately
      if (!selectedTimeline && compliancePlan.timeline && compliancePlan.timeline.length > 0) {
        setSelectedTimeline(compliancePlan.timeline[0]);
      }
      setProgress('Analysis complete');
      const actionCount = timelineSections.flatMap(s => s.actions).length;
      setNotifications(prev => ([
        ...prev,
        { id: 'analysis-complete', message: `Compliance analysis completed! ${actionCount} actions generated`, type: 'update' }
      ]));

    } catch (e: any) {
      setError(e?.message || 'Analysis failed. Please try again.');
      setNotifications(prev => ([...prev, { id: 'error', message: 'Compliance analysis failed', type: 'alert' }]));
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  }, [API_BASE, companyId, amendments]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const Header = () => (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Compliance Intelligence Hub</h1>
        <p className="text-gray-400 text-sm">AI-powered regulatory monitoring for {companyId || 'your company'}</p>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={runCompliance} 
          disabled={loading} 
          className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 
            ${loading 
              ? 'bg-gray-700 text-gray-400' 
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20' 
            }`}
        >
          <TestTube className="h-4 w-4" /> 
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
              <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse delay-100"></span>
              <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse delay-200"></span>
            </span>
          ) : (
            "Test Compliance"
          )}
        </button>
        <button className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors relative">
          <Bell className="h-5 w-5 text-gray-300" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {notifications.length}
            </span>
          )}
        </button>
        <button className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
          <Settings className="h-5 w-5 text-gray-300" />
        </button>
      </div>
    </div>
  );

  const CompliancePlanCard = ({ plan }: { plan?: CompliancePlan }) => {
    if (!plan) return null;
    
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Compliance Action Plan</h2>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              plan.status === 'requires_action' ? 'bg-yellow-500/20 text-yellow-400' :
              plan.status === 'compliant' ? 'bg-emerald-500/20 text-emerald-400' :
              'bg-gray-700 text-gray-300'
            }`}>
              {plan.status === 'requires_action' ? 'Action Required' : 
               plan.status === 'compliant' ? 'Compliant' : 'In Review'}
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {plan.timeline?.map((slot, idx) => (
            <div 
              key={idx} 
              className={`border rounded-lg p-5 cursor-pointer transition-colors ${
                selectedTimeline?.timeframe === slot.timeframe ? 'border-emerald-500/40 bg-gray-900' : 'border-gray-800 bg-gray-900/50'
              }`}
              onClick={() => setSelectedTimeline(slot)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">{slot.timeframe}</h3>
                <span className="text-sm text-gray-400">
                  {slot.actions.length} action{slot.actions.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="space-y-3">
                {slot.actions.map((action, i) => (
  <div key={i} className={`p-4 rounded-lg border ${
    action.urgency === 'Critical' ? 'border-red-500/30 bg-red-500/10' :
    action.urgency === 'High' ? 'border-yellow-500/30 bg-yellow-500/10' :
    'border-gray-700 bg-gray-800/50'
  }`}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm font-medium text-gray-300 mb-1">{action.department}</div>
        <h4 className="text-white font-medium">{action.task}</h4>
      </div>
      {action.urgency && (
        <span className={`px-2.5 py-0.5 rounded-full text-xs ${
          action.urgency === 'Critical' ? 'bg-red-500/20 text-red-300' :
          action.urgency === 'High' ? 'bg-yellow-500/20 text-yellow-300' :
          'bg-gray-700 text-gray-300'
        }`}>
          {action.urgency}
        </span>
      )}
    </div>

    {action.deadline && (
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
        <Calendar className="h-3 w-3" />
        Deadline: {action.deadline}
      </div>
    )}

    {/* Add this new label comparison section */}
    {action.currentLabel && (
      <div className="mt-4">
        <div className="text-xs text-gray-400 mb-2">LABEL COMPARISON</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Current Label</div>
            <img 
              src={action.currentLabel} 
              alt="Current product label"
              className="rounded border border-gray-700 w-full h-auto"
            />
            <ul className="mt-2 space-y-1 text-xs text-red-400">
              {action.currentIssues?.map((issue, i) => (
                <li key={i} className="flex items-start gap-1">
                  <X className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Required Label</div>
            <img 
              src={action.requiredLabel} 
              alt="Required label changes"
              className="rounded border border-gray-700 w-full h-auto"
            />
            <ul className="mt-2 space-y-1 text-xs text-emerald-400">
              {action.labelRequirements?.map((req, i) => (
                <li key={i} className="flex items-start gap-1">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {action.productComposition && (
          <div className="mt-3 p-3 bg-gray-800 rounded text-sm">
            <div className="font-medium text-white mb-1">Your Product Details:</div>
            <div className="text-gray-300">
              {action.productComposition}. This must be clearly declared on the front panel.
            </div>
          </div>
        )}
      </div>
    )}

    {action.steps?.length && (
      <div className="mt-3">
        <div className="text-xs text-gray-400 mb-1">Implementation Steps:</div>
        <ul className="space-y-1.5">
          {action.steps.map((step, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-gray-500">•</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {action.amendments?.length && (
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="text-xs text-gray-400 mb-1">Related Amendments:</div>
        <div className="flex flex-wrap gap-1.5">
          {action.amendments.map((amendment, k) => (
            <span key={k} className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded">
              {amendment}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
))}
              </div>
            </div>
          ))}
        </div>

        {plan.summary && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-lg font-medium text-white mb-3">Compliance Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Total Actions</div>
                <div className="text-2xl font-bold text-white">{plan.summary.total_actions}</div>
              </div>
              <div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20">
                <div className="text-yellow-400 text-sm mb-1">High Priority</div>
                <div className="text-2xl font-bold text-yellow-300">{plan.summary.high_priority}</div>
              </div>
              <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                <div className="text-red-400 text-sm mb-1">Critical</div>
                <div className="text-2xl font-bold text-red-300">{plan.summary.critical_items}</div>
              </div>
            </div>
          </div>
        )}

        {plan.next_steps?.length && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-lg font-medium text-white mb-3">Recommended Next Steps</h3>
            <ul className="space-y-2">
              {plan.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const AmendmentCard = ({ amendment }: { amendment: any }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-medium text-white">{amendment.title}</h3>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
          {safeFormatDate(amendment.date)}
        </span>
      </div>

      {amendment.summary && (
        <p className="text-gray-300 text-sm mb-4">{amendment.summary}</p>
      )}

      {amendment.requirements?.length && (
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">KEY REQUIREMENTS</div>
          <ul className="space-y-2">
            {amendment.requirements.map((req: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-gray-500 mt-0.5">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {amendment.relevance_reason && (
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">WHY THIS AFFECTS YOU</div>
          <p className="text-sm text-gray-300">{amendment.relevance_reason}</p>
        </div>
      )}

      {amendment.product_impacts?.length && (
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">PRODUCT IMPACTS</div>
          <div className="space-y-3">
            {amendment.product_impacts.map((impact: any, i: number) => (
              <div key={i} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                <div className="text-sm font-medium text-white mb-1">{impact.product_name}</div>
                <div className="text-xs text-gray-400 mb-2">
                  Affected aspects: {impact.affected_aspects.join(', ')}
                </div>
                <ul className="space-y-1.5">
                  {impact.required_changes.map((change: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="text-gray-500">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {(amendment.document_id || amendment.pdf_url) && (
        <a
          href={amendment.pdf_url || `${FRONT_API_BASE}/pdf?document_id=${encodeURIComponent(amendment.document_id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <FileText className="h-4 w-4" />
          View full regulation document
        </a>
      )}
    </div>
  );

  const ComplianceChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string, formatted?: React.ReactNode}>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Function to format AI responses with rich formatting
  const formatAIResponse = (text: string): React.ReactNode => {
    // Split into paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    return (
      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => {
          // Check if this is a heading
          if (paragraph.match(/^[A-Z][^:]*:$/) || paragraph.match(/^###/)) {
            return (
              <h4 key={index} className="font-semibold text-emerald-300 text-sm">
                {paragraph.replace('###', '').replace(':', '')}
              </h4>
            );
          }
          
          // Check for bullet points
          if (paragraph.includes('* ') || paragraph.includes('- ')) {
            const lines = paragraph.split('\n');
            return (
              <div key={index} className="space-y-1">
                {lines.map((line, lineIndex) => {
                  if (line.startsWith('* ') || line.startsWith('- ')) {
                    return (
                      <div key={lineIndex} className="flex items-start">
                        <span className="text-emerald-400 mr-2 mt-1">•</span>
                        <span className="text-gray-200 text-sm">{line.substring(2)}</span>
                      </div>
                    );
                  }
                  return (
                    <p key={lineIndex} className="text-gray-200 text-sm">{line}</p>
                  );
                })}
              </div>
            );
          }
          
          // Check for bold text (text between **)
          if (paragraph.includes('**')) {
            const parts = paragraph.split('**');
            return (
              <p key={index} className="text-gray-200 text-sm">
                {parts.map((part, partIndex) => 
                  partIndex % 2 === 1 ? (
                    <span key={partIndex} className="font-semibold text-white">{part}</span>
                  ) : (
                    part
                  )
                )}
              </p>
            );
          }
          
          // Regular paragraph
          return (
            <p key={index} className="text-gray-200 text-sm leading-relaxed">
              {paragraph}
            </p>
          );
        })}
      </div>
    );
  };

  const sendMessage = async () => {
    if (!input.trim() || !companyId) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      formatted: <p className="text-white text-sm">{userMessage}</p>
    }]);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/chatbot/analyze?company_id=${companyId}&query=${encodeURIComponent(userMessage)}`
      );
      const data = await response.json();
      
      if (data.status === 'success') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response,
          formatted: formatAIResponse(data.response)
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.',
          formatted: <p className="text-red-300 text-sm">Sorry, I encountered an error. Please try again.</p>
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Unable to connect to the compliance analysis service.',
        formatted: <p className="text-red-300 text-sm">Unable to connect to the compliance analysis service.</p>
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chatbot Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 group"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 scale-0 group-hover:scale-100 transition-transform">
          AI
        </span>
      </button>

      {/* Enhanced Chatbot Panel - Made Much Wider */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-6 z-50 w-[800px] max-w-[90vw] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        >
          {/* Header with gradient */}
          <div className="p-6 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 rounded-t-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-600 p-2 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Compliance Intelligence</h3>
                  <p className="text-emerald-300 text-xs">Powered by Gemini AI</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                "Urgent actions?",
                "Labeling requirements?",
                "Deadlines?",
                "Amendments summary"
              ].map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInput(prompt)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded-full transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Container with proper background */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900 min-h-[400px]">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-gray-800 p-4 rounded-2xl mb-4">
                  <FileText className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                  <h4 className="font-semibold text-white mb-2">Compliance Assistant</h4>
                  <p className="text-gray-300 text-sm">
                    Ask me about regulations, deadlines, or specific amendments affecting your business
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h5 className="font-medium text-emerald-300 text-xs mb-1">📋 Amendments</h5>
                    <p className="text-gray-400 text-xs">Ask about specific regulatory changes</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h5 className="font-medium text-red-300 text-xs mb-1">⏰ Deadlines</h5>
                    <p className="text-gray-400 text-xs">Check compliance timelines</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h5 className="font-medium text-emerald-300 text-xs mb-1">🏷️ Labeling</h5>
                    <p className="text-gray-400 text-xs">Packaging requirements</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-300 text-xs mb-1">📊 Status</h5>
                    <p className="text-gray-400 text-xs">Overall compliance status</p>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-800 border border-gray-700'
                    }`}
                  >
                    {message.formatted || (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl max-w-[70%]">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-emerald-300 text-sm">Analyzing compliance data...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Input Area with solid background */}
          <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-b-2xl">
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask about compliance requirements, deadlines, or amendments..."
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-400"
                  disabled={isLoading}
                />
                {input && (
                  <button
                    onClick={() => setInput('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors flex items-center justify-center min-w-[50px]"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            
            {/* Quick tips */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-gray-400 text-xs">
                💡 Try: What are the urgent actions needed?
              </span>
              <span className="text-emerald-400 text-xs">
                {companyId ? 'Connected' : 'Company data needed'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

  const NotificationItem = ({ notification }: { notification: {id: string; message: string; type: 'alert' | 'update'} }) => (
    <div className={`p-3 rounded-lg flex items-start justify-between ${
      notification.type === 'alert' ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
    }`}>
      <div className="flex items-start gap-2">
        {notification.type === 'alert' ? (
          <AlertTriangle className="h-4 w-4 mt-0.5 text-red-400" />
        ) : (
          <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-400" />
        )}
        <span className="text-sm text-gray-200">{notification.message}</span>
      </div>
      <button 
        onClick={() => dismissNotification(notification.id)}
        className="text-gray-400 hover:text-gray-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
  const PageLoadingScreen = () => (
  <div className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto px-6">
      {/* Vigilo Logo */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Vigilo</h1>
        <p className="text-gray-400">AI Compliance Intelligence</p>
      </div>

      {/* Loading Animation */}
      <div className="mb-6 flex justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-800 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>

      {/* Dynamic Loading Message */}
      <div className="mb-4">
        <p className="text-white font-medium mb-1">{loadingMessage}</p>
        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Loading Details */}
      <div className="text-sm text-gray-400 space-y-1">
        <p>• Connecting to FSSAI database</p>
        <p>• Analyzing {companyId || 'your'} company profile</p>
        <p>• Processing regulatory updates</p>
      </div>
    </div>
  </div>
);

  return (
    
  <div className="min-h-screen bg-gray-950 text-gray-100">
    {/* Page Loading Screen */}
    {pageLoading && <PageLoadingScreen />}
    {/* Notification Stack */}
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>

    <div className="flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col h-screen sticky top-0">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-1">Vigilo</h2>
          <p className="text-xs text-gray-400">AI Compliance Monitor</p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            <li>
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-gray-800 text-white rounded-lg font-medium">
                <FileText className="h-4 w-4" />
                Compliance Hub
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <Calendar className="h-4 w-4" />
                Timeline
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <TestTube className="h-4 w-4" />
                Risk Assessment
              </a>
            </li>
          </ul>
        </nav>

        {selectedTimeline && (
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-2">TIMELINE DETAILS</div>
            <div className="text-sm text-white font-medium mb-2">{selectedTimeline.timeframe}</div>
            <ul className="space-y-3">
              {selectedTimeline.actions.map((a, i) => (
                <li key={i} className="text-xs text-gray-300">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-200">{a.task}</span>
                    {a.deadline && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="h-3 w-3" /> {a.deadline === 'Unknown' ? 'Unknown' : safeFormatDate(a.deadline)}
                      </span>
                    )}
                  </div>
                  {a.department && (
                    <div className="mt-1 text-[10px] text-gray-500">{a.department}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto pt-6 border-t border-gray-800">
          <div className="text-xs text-gray-400 mb-2">Compliance Status</div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-white">Overall Score</div>
            <div className="text-emerald-400 font-semibold">
              {analysis?.compliance_plan?.summary?.compliance_score || 82}%
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" 
              style={{ width: `${analysis?.compliance_plan?.summary?.compliance_score || 82}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <Header />


        {/* Status Messages */}
        {!companyId && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 p-4 rounded-lg mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium mb-1">Company profile required</h3>
              <p className="text-sm">Please submit your company details from the Upload Docs page to enable compliance analysis.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-lg mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium mb-1">Analysis Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <div>
                <div className="text-white font-medium">{progress}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {activeStep === 0 && "Parsing latest regulatory documents..."}
                  {activeStep === 1 && "Matching against your product portfolio..."}
                  {activeStep === 2 && "Evaluating packaging compliance..."}
                  {activeStep === 3 && "Checking document requirements..."}
                  {activeStep === 4 && "Finalizing recommendations..."}
                </div>
              </div>
            </div>
          </div>
        )}

        {analysis ? (
          <div className="space-y-8">
            {/* Chicory Labels compliance spotlight (only after analysis) */}
            <ChicoryLabelsCard />

            {/* Evidence-rich compliance findings */}
            {analysis.findings?.length ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Compliance Findings</h2>
                  <div className="text-sm text-gray-400">{analysis.findings.length} findings</div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {analysis.findings.map((f: any, i: number) => (
                    <FindingCard key={i} finding={f} />
                  ))}
                </div>
              </div>
            ) : null}

            <CompliancePlanCard plan={analysis.compliance_plan} />

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Affected Regulations</h2>
                <div className="text-sm text-gray-400">
                  {analysis.relevant_amendments} of {analysis.initial_amendments} amendments apply
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {analysis.detailed_amendments?.map((amendment, i) => (
                  <AmendmentCard key={i} amendment={amendment} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Latest Regulatory Updates</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search amendments..."
                    className="bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <select
                    className="bg-gray-900 border border-gray-800 rounded-lg pl-3 pr-8 py-2 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All Updates</option>
                    <option value="critical">Critical</option>
                    <option value="recent">Last 30 Days</option>
                  </select>
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
              
            </div>

            {filteredAmendments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAmendments.map((amendment, i) => (
                  <AmendmentCard 
                    key={i} 
                    amendment={{
                      ...amendment,
                      summary: amendment.title.includes('Coffee') || amendment.title.includes('Chicory')
                        ? 'New labeling requirements for coffee-chicory mixtures including mandatory front-of-pack declarations in specific font sizes.'
                        : amendment.title.includes('Packaging')
                          ? 'Updated standards for recycled plastics in food contact materials with new migration limits.'
                          : 'General food safety updates that may affect manufacturing processes or documentation requirements.'
                    }} 
                  />
                ))}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                <div className="text-gray-400 mb-2">No amendments match your filters</div>
                <button 
                  onClick={() => {
                    setSearchTerm("");
                    setFilter("all");
                  }}
                  className="text-emerald-400 hover:text-emerald-300 text-sm"
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right Sidebar - Process Logs */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 p-6 sticky top-0 h-screen overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">Analysis Process</h3>
        
        {analysis ? (
          <div className="space-y-4">
            {Object.entries(analysis.analysis_steps || {}).map(([stage, logs]) => (
              <div key={stage} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-200 mb-2">
                  {stage.replace('Stage', 'Step')}
                </div>
                <ul className="text-xs text-gray-400 space-y-2">
                  {(logs as string[]).map((log, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-500" />
                      <span>{log.replace(/^\[.*?\] /, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
            <div className="text-gray-500 text-sm">No analysis logs yet</div>
            <p className="text-gray-400 text-xs mt-2">
              Run a compliance check to see detailed process logs
            </p>
          </div>
        )}
      </div>
    </div>
    <ComplianceChatbot />
  </div>
)};