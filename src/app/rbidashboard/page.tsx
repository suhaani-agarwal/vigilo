"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TestTube, Bell, Settings, Calendar, FileText, ChevronRight, AlertTriangle, CheckCircle, X, Filter, Search, TrendingUp, Shield, DollarSign } from 'lucide-react';

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
      currentDocument?: string; 
      requiredDocument?: string;
      documentRequirements?: string[];
      currentIssues?: string[];
      portfolioComposition?: string;
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

type Analysis = {
  analysis_steps?: Record<string, string[]>;
  initial_amendments?: number;
  relevant_amendments?: number;
  compliance_plan?: CompliancePlan;
  detailed_amendments?: any[];
};

type MetaItem = {
  title: string;
  date: string;
  source?: string;
  pdf_url?: string;
  pdf_path?: string;
  document_id?: string;
};

export default function FinanceDashboardPage() {
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
          message: 'SEC just released new ESG reporting amendment (2025/08/15)',
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

useEffect(() => {
  const loadRBIAmendments = async () => {
    const loadingMessages = [
      "Initializing RBI compliance dashboard...",
      "Fetching RBI notification database...",
      "Scanning latest RBI circulars...", 
      "Analyzing banking regulations...",
      "Cross-referencing financial compliance...",
      "Evaluating regulatory updates...",
      "Loading RBI compliance insights..."
    ];

    // Simulate loading with dynamic messages
    for (let i = 0; i < loadingMessages.length; i++) {
      setLoadingMessage(loadingMessages[i]);
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 2500 : 1500));
    }

    try {
      // Use the RBI-specific endpoint
      const res = await fetch(`${API_BASE}/list-rbi`);
      if (res.ok) {
        const json = await res.json();
        setAmendments((json as MetaItem[]).slice(0, 10));
        
        // Count RBI amendments for the notification
        const rbiCount = json.length;
        
        setPageLoading(false);
        setIntroLoading(false);

        // Show welcome notifications after loading
        setTimeout(() => {
          setNotifications(prev => [
            ...prev,
            {
              id: 'rbi-dashboard-loaded',
              message: `RBI Dashboard loaded! Found ${rbiCount} RBI notifications`,
              type: 'update'
            }
          ]);
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to load RBI amendments:", err);
      setPageLoading(false);
      setIntroLoading(false);
    }
  };
  loadRBIAmendments();
}, [API_BASE]);

const filteredAmendments = useMemo(() => {
    return amendments.filter(amendment => {
      const matchesSearch = amendment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          amendment.source?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === "all" || 
                          (filter === "critical" && (amendment.title.includes("KYC") || amendment.title.includes("Digital Lending"))) ||
                          (filter === "recent" && amendment.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      return matchesSearch && matchesFilter;
    });
  }, [amendments, searchTerm, filter]);

  const runCompliance = useCallback(async () => {
    if (!companyId) {
      setError('Please submit your firm details first from the Upload Docs page.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setActiveStep(-1);

    const steps = [
      'Analyzing latest RBI/SEBI/NPCI circulars...',
      'Cross-referencing with your NBFC/Bank license conditions...',
      'Evaluating KYC/AML compliance requirements...',
      'Assessing capital adequacy and provisioning norms...',
      'Generating actionable compliance roadmap...'
    ];

    const logs: Record<string, string[]> = {};
    const pushLog = (stage: string, msg: string) => {
      const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
      logs[stage] = [...(logs[stage] || []), `[${t}] ${msg}`];
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      // Simulate each step with progress updates
      for (let i = 0; i < steps.length; i++) {
        setActiveStep(i);
        setProgress(steps[i]);
        pushLog(`Stage ${i + 1}`, steps[i]);
        
        // Simulate different processing times for each step
        await sleep(i === 0 ? 2200 : i === 1 ? 1800 : i === 2 ? 3000 : 2500);
        
        // Add detailed logs for each step
        if (i === 0) {
          pushLog(`Stage ${i + 1}`, "Identified 8 new circulars from RBI/SEBI/NPCI");
          pushLog(`Stage ${i + 1}`, "Extracted compliance requirements from each regulation");
        } else if (i === 1) {
          pushLog(`Stage ${i + 1}`, "Matched your NBFC-ICC license against new norms");
          pushLog(`Stage ${i + 1}`, "Found 4 potential compliance gaps");
        } else if (i === 2) {
          pushLog(`Stage ${i + 1}`, "Analyzed V-CIP implementation status");
          pushLog(`Stage ${i + 1}`, "Identified 3 KYC process updates needed");
        } else if (i === 3) {
          pushLog(`Stage ${i + 1}`, "Verified CRAR and provisioning compliance");
          pushLog(`Stage ${i + 1}`, "2 capital adequacy adjustments required");
        }
      }

      // Generate realistic compliance analysis for Indian regulations
      const digitalLendingAmendment = amendments.find(a => a.title.includes('Digital Lending'));
      const kycAmendment = amendments.find(a => a.title.includes('KYC'));
      const nbfcAmendment = amendments.find(a => a.title.includes('Scale Based'));

      const detailedAmendments = [
        {
          title: digitalLendingAmendment?.title || "RBI Digital Lending Guidelines 2025",
          date: digitalLendingAmendment?.date || "2025-08-20",
          summary: "Comprehensive framework for digital lending covering all regulated entities and their lending service providers (LSPs). Mandates direct disbursement, cooling-off period, and standardized Key Fact Statement.",
          requirements: [
            "All loan disbursals and repayments must flow directly between borrower and RE bank accounts",
            "Mandatory cooling-off/look-up period during loan sanction with explicit consent",
            "Standardized Key Fact Statement (KFS) before loan execution",
            "Data collected by DLAs/LSPs to be need-based with prior consent",
            "Annual percentage rate (APR) disclosure in KFS inclusive of all charges"
          ],
          relevance_reason: "As an NBFC-ICC with digital lending partnerships, you must ensure all LSP arrangements comply",
          product_impacts: [
            {
              product_name: "Digital Personal Loans",
              affected_aspects: ["loan origination system", "partner agreements"],
              required_changes: [
                "Modify loan management system for direct disbursement only",
                "Implement cooling-off period in loan sanction workflow",
                "Update all LSP agreements to comply with data sharing norms"
              ]
            },
            {
              product_name: "BNPL Products",
              affected_aspects: ["merchant agreements", "customer onboarding"],
              required_changes: [
                "Restructure merchant settlement to ensure direct fund flow",
                "Add APR disclosure in all BNPL communications"
              ]
            }
          ],
          document_id: digitalLendingAmendment?.document_id
        },
        {
          title: kycAmendment?.title || "RBI Master Direction on KYC Updates",
          date: kycAmendment?.date || "2025-07-25",
          summary: "Updated KYC norms mandating Video-based Customer Identification Process (V-CIP) for high-value remote onboarding and periodic KYC updation timelines.",
          requirements: [
            "V-CIP mandatory for individual customers with aggregate credit/deposit > ₹50 lakh",
            "Live GPS coordinates capture during V-CIP process",
            "Periodic KYC update every 2 years for high-risk, 8 years for medium-risk customers",
            "Centralized KYC Registry (CKYCR) upload within 10 days of account opening",
            "Risk categorization review at least once in 6 months"
          ],
          relevance_reason: "Your NBFC handles high-value customer accounts requiring enhanced due diligence",
          product_impacts: [
            {
              product_name: "Premium Banking Services",
              affected_aspects: ["onboarding process", "risk management"],
              required_changes: [
                "Integrate V-CIP solution with live location capture",
                "Automate periodic KYC triggers based on risk category",
                "Implement CKYCR API for automatic uploads"
              ]
            }
          ],
          document_id: kycAmendment?.document_id
        },
        {
          title: nbfcAmendment?.title || "RBI Scale Based Regulation for NBFCs",
          date: nbfcAmendment?.date || "2025-06-15",
          summary: "Enhanced regulatory framework for Upper Layer and Middle Layer NBFCs including higher capital requirements and mandatory Core Financial Services Solution implementation.",
          requirements: [
            "Upper Layer NBFCs to maintain minimum CRAR of 11%",
            "Implementation of Core Financial Services Solution (CFSS) by October 2025",
            "Quarterly submission of granular data on assets and liabilities",
            "Board-approved policy on Internal Capital Adequacy Assessment Process (ICAAP)",
            "Leverage ratio of 4% for Upper Layer NBFCs"
          ],
          relevance_reason: "With AUM > ₹5000 Cr, your NBFC falls under Upper Layer requiring enhanced compliance",
          product_impacts: [
            {
              product_name: "Overall Operations",
              affected_aspects: ["capital planning", "IT infrastructure"],
              required_changes: [
                "Raise additional Tier-1 capital to meet 11% CRAR",
                "Procure and implement CFSS solution",
                "Establish ICAAP framework with stress testing"
              ]
            }
          ],
          document_id: nbfcAmendment?.document_id
        }
      ];

      const compliancePlan: CompliancePlan = {
        timeline: [
          {
            timeframe: "Immediate (1-2 weeks)",
            actions: [
              {
                department: "Compliance & Legal",
                task: "Submit compliance update for RBI Draft: Digital Banking Channels Authorisation Directions, 2025",
                steps: [
                  "Review all digital platform product listings",
                  "Implement consent management system for customer approvals",
                  "Integrate mandatory risk-check mechanisms in digital workflows",
                  "Prepare compliance submission package for RBI"
                ],
                urgency: "Critical",
                amendments: ["RBI Digital Banking Channels Authorisation Directions, 2025 (Draft)"],
                deadline: "2025-09-30",
                currentDocument: "/current-digital-platform.png",
                requiredDocument: "/required-digital-platform.png",
                documentRequirements: [
                  "Must prohibit promotion of third-party products without RBI approval",
                  "Must capture explicit customer consent for digital offerings",
                  "Must integrate mandatory risk checks for all online services",
                  "Must maintain audit trail of consents and risk controls"
                ],
                currentIssues: [
                  "currently promoting third-party products (including group entities) on digital platforms",
                  "Customer consent often implicit or bundled with other agreements",
                  "Risk checks for digital transactions not consistently applied"
                ],
                portfolioComposition:
                  "Digital channels used by ~5M customers across retail banking, credit cards, and mutual fund/insurance distribution"
              },
              {
                department: "Technology",
                task: "Implement V-CIP for high-value customer onboarding",
                steps: [
                  "Procure V-CIP solution with GPS capability",
                  "Integrate with core banking system",
                  "Train customer service team"
                ],
                urgency: "High",
                amendments: ["RBI Master Direction on KYC Updates"],
                deadline: "2025-09-20"
              }
            ]
        }, 
          {
            timeframe: "Short-term (3-4 weeks)",
            actions: [
              {
                department: "Finance & Risk",
                task: "Enhance capital to meet 11% CRAR requirement",
                steps: [
                  "Calculate capital shortfall based on current risk-weighted assets",
                  "Prepare board note for capital raising",
                  "Initiate Tier-1 capital issuance process"
                ],
                urgency: "High",
                amendments: ["RBI Scale Based Regulation for NBFCs"],
                deadline: "2025-09-30"
              },
              {
                department: "Operations",
                task: "Establish CKYCR upload automation",
                steps: [
                  "Implement CKYCR API integration",
                  "Set up daily upload batch process",
                  "Create exception handling workflow"
                ],
                urgency: "Medium",
                amendments: ["RBI Master Direction on KYC Updates"],
                deadline: "2025-10-15"
              }
            ]
          },
          {
            timeframe: "Medium-term (2-3 months)",
            actions: [
              {
                department: "IT",
                task: "Implement Core Financial Services Solution",
                steps: [
                  "Evaluate CFSS vendors approved by RBI",
                  "Complete procurement and customization",
                  "Migrate data and go-live"
                ],
                urgency: "High",
                amendments: ["RBI Scale Based Regulation for NBFCs"],
                deadline: "2025-10-31"
              }
            ]
          },
          {
            timeframe: "Ongoing",
            actions: [
              {
                department: "Compliance",
                task: "Monitor RBI/SEBI/NPCI regulatory updates",
                steps: [
                  "Subscribe to regulatory notifications",
                  "Attend IBA/FIDC compliance workshops",
                  "Quarterly compliance review with board"
                ],
                urgency: "Medium",
                amendments: ["All"],
                deadline: "Continuous"
              }
            ]
          }
        ],
        summary: {
          critical_items: 1,
          high_priority: 3,
          total_actions: 6,
          compliance_score: 72
        },
        status: "requires_action",
        notes: "Generated by Vigilo India Compliance AI based on latest RBI/SEBI/NPCI regulations",
        next_steps: [
          "Schedule emergency board meeting for capital raising approval",
          "Initiate RFP process for CFSS vendor selection",
          "File Digital Lending compliance certificate by Sept 5"
        ]
      };

      setAnalysis({
        analysis_steps: logs,
        initial_amendments: amendments.length,
        relevant_amendments: detailedAmendments.length,
        compliance_plan: compliancePlan,
        detailed_amendments: detailedAmendments
      });
      setProgress("Analysis complete");

      // Add completion notification
      setNotifications(prev => [
        ...prev,
        {
          id: 'analysis-complete',
          message: 'Compliance analysis completed! 6 regulatory actions required',
          type: 'update'
        }
      ]);

    } catch (e: any) {
      setError(e?.message || 'Analysis failed. Please try again.');
      setNotifications(prev => [
        ...prev,
        {
          id: 'error',
          message: 'Compliance analysis failed',
          type: 'alert'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, companyId, amendments]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const Header = () => (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Indian Regulatory Compliance Hub</h1>
        <p className="text-gray-400 text-sm">RBI, SEBI & NPCI compliance monitoring for {companyId || 'your institution'}</p>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={runCompliance} 
          disabled={loading || !companyId} 
          className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 
            ${loading 
              ? 'bg-gray-700 text-gray-400' 
              : companyId 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20' 
                : 'bg-gray-800 text-gray-400 cursor-not-allowed'
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
            "Run Compliance Check"
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
          <h2 className="text-xl font-semibold text-white">Regulatory Action Plan</h2>
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
            <div key={idx} className="border border-gray-800 rounded-lg p-5 bg-gray-900/50">
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

   {/* Add document comparison section */}
   {action.currentDocument && (
      <div className="mt-4">
        <div className="text-xs text-gray-400 mb-2">DOCUMENT COMPLIANCE GAP</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Current Agreement/Filing</div>
            <img 
              src= "/before.png"
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
            <div className="text-xs text-gray-500 mb-1">Required Compliance Updates</div>
            <img 
              src= "/after.png" 
              className="rounded border border-gray-700 w-full h-auto"
            />
            <ul className="mt-2 space-y-1 text-xs text-emerald-400">
              {action.documentRequirements?.map((req, i) => (
                <li key={i} className="flex items-start gap-1">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {action.portfolioComposition && (
          <div className="mt-3 p-3 bg-gray-800 rounded text-sm">
            <div className="font-medium text-white mb-1">Your Portfolio Details:</div>
            <div className="text-gray-300">
              {action.portfolioComposition}. This must be clearly disclosed in all client communications.
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
        <div className="text-xs text-gray-400 mb-1">Related Regulations:</div>
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
          {new Date(amendment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
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
          <div className="text-xs text-gray-400 mb-2">PORTFOLIO IMPACTS</div>
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

      {amendment.document_id && (
        <a
          href={`${API_BASE}/pdf?document_id=${encodeURIComponent(amendment.document_id)}`}
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
        <p className="text-gray-400">AI Financial Compliance Intelligence</p>
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
        <p>• Connecting to RBI/SEBI database</p>
        <p>• Analyzing {companyId || 'your'} firm profile</p>
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
          <p className="text-xs text-gray-400">AI Finance Compliance</p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            <li>
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-gray-800 text-white rounded-lg font-medium">
                <Shield className="h-4 w-4" />
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
                <TrendingUp className="h-4 w-4" />
                Risk Assessment
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <DollarSign className="h-4 w-4" />
                Portfolio Analysis
              </a>
            </li>
          </ul>
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-800">
          <div className="text-xs text-gray-400 mb-2">Compliance Status</div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-white">Overall Score</div>
            <div className="text-emerald-400 font-semibold">
              {analysis?.compliance_plan?.summary?.compliance_score || 75}%
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" 
              style={{ width: `${analysis?.compliance_plan?.summary?.compliance_score || 75}%` }}
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
              <h3 className="font-medium mb-1">Firm profile required</h3>
              <p className="text-sm">Please submit your firm details from the Upload Docs page to enable compliance analysis.</p>
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
                  {activeStep === 1 && "Matching against your investment portfolio..."}
                  {activeStep === 2 && "Evaluating disclosure compliance..."}
                  {activeStep === 3 && "Checking documentation requirements..."}
                  {activeStep === 4 && "Finalizing recommendations..."}
                </div>
              </div>
            </div>
          </div>
        )}

        {analysis ? (
          <div className="space-y-8">
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
                    placeholder="Search regulations..."
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
                      summary: amendment.title.includes('ESG') || amendment.title.includes('Reporting')
                        ? 'New environmental, social, and governance disclosure requirements for investment advisors managing over $1B in assets.'
                        : amendment.title.includes('Crypto')
                          ? 'Enhanced supervision and disclosure requirements for firms offering cryptocurrency-related investment products.'
                          : amendment.title.includes('Capital') || amendment.title.includes('Basel')
                            ? 'Updated capital adequacy requirements and stress testing procedures for financial institutions.'
                            : 'General financial regulatory updates that may affect reporting processes or compliance documentation.'
                    }} 
                  />
                ))}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                <div className="text-gray-400 mb-2">No regulations match your filters</div>
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
  </div>
);
};