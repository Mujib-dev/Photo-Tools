/**
 * Smart Contract & Legal Agreement Analyzer Engine
 *
 * Scans legal contracts, NDAs, and agreements for:
 * 1. Hidden "Gotchas" & Dangerous Red Flags (Uncapped Liability, IP Forfeiture, Non-Competes)
 * 2. Executive Plain-English Summaries (What you are actually agreeing to)
 * 3. Deadlines, Obligations & Payment Terms Extraction
 * 4. Contract Fairness Rating (Balanced vs One-Sided)
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface LegalRiskItem {
  id: string;
  category:
    | "liability"
    | "ip_rights"
    | "termination"
    | "auto_renewal"
    | "non_compete"
    | "payment"
    | "confidentiality"
    | "jurisdiction";
  title: string;
  severity: RiskLevel;
  excerpt: string;
  explanation: string;
  recommendation: string;
}

export interface ContractObligation {
  party: string;
  type: "payment" | "deliverable" | "deadline" | "notice" | "restriction";
  description: string;
  timeframe?: string;
}

export interface LegalAnalysisResult {
  contractType: string;
  overallRiskScore: number; // 0 to 100 (0 = very safe, 100 = extreme danger)
  riskRating: RiskLevel;
  executiveSummary: string[];
  governingLaw: string | null;
  effectiveDate: string | null;
  partiesDetected: string[];
  risks: LegalRiskItem[];
  obligations: ContractObligation[];
  fairnessScore: number; // 0 to 100 (100 = completely balanced)
  pros: string[];
  cons: string[];
}

export function analyzeLegalAgreement(contractText: string): LegalAnalysisResult {
  const clean = contractText.trim();
  const lower = clean.toLowerCase();

  // 1. Contract Type Detection
  let contractType = "General Commercial Agreement";
  if (/non-disclosure|confidentiality\s+agreement|\bnda\b/i.test(clean)) {
    contractType = "Non-Disclosure Agreement (NDA)";
  } else if (/independent\s+contractor|consulting\s+agreement|master\s+services\s+agreement|\bmsa\b|freelance/i.test(clean)) {
    contractType = "Independent Contractor / Consulting Agreement";
  } else if (/employment\s+agreement|offer\s+letter|at-will\s+employment/i.test(clean)) {
    contractType = "Employment Agreement";
  } else if (/lease\s+agreement|tenancy|landlord\s+and\s+tenant|rental\s+agreement/i.test(clean)) {
    contractType = "Lease & Rental Agreement";
  } else if (/terms\s+of\s+service|terms\s+and\s+conditions|\beula\b|software\s+license/i.test(clean)) {
    contractType = "Software Terms of Service (SaaS / EULA)";
  }

  // 2. Extract Governing Law & Parties
  let governingLaw: string | null = null;
  const lawMatch = clean.match(/(?:governed by|laws of|jurisdiction of|construed in accordance with)\s+(?:the\s+laws\s+of\s+)?(?:the\s+State\s+of\s+)?([A-Za-z\s,]+?)(?:\.|\;|\n|and each)/i);
  if (lawMatch && lawMatch[1]) {
    governingLaw = lawMatch[1].trim().slice(0, 45);
  }

  let effectiveDate: string | null = null;
  const dateMatch = clean.match(/(?:effective date|dated as of|entered into as of)\s+([A-Za-z0-9,\s]{6,30}?)(?:\.|\;|\n|by and between)/i);
  if (dateMatch && dateMatch[1]) {
    effectiveDate = dateMatch[1].trim();
  }

  // Parties detection
  const parties: string[] = [];
  const partyMatch = clean.match(/by and between\s+([^,]+?)(?:,|\s+and\s+)([^,.\n]+)/i);
  if (partyMatch) {
    if (partyMatch[1]) parties.push(partyMatch[1].trim().slice(0, 50));
    if (partyMatch[2]) parties.push(partyMatch[2].trim().slice(0, 50));
  }
  if (parties.length === 0) {
    if (/client|company/i.test(clean)) parties.push("Company / Client");
    if (/contractor|service provider|employee/i.test(clean)) parties.push("Contractor / Provider");
  }

  // 3. Scan for Red Flags & Dangerous Gotchas
  const risks: LegalRiskItem[] = [];

  // Check A: Uncapped Indemnification & Liability
  const uncappedMatch = clean.match(/indemnif(?:y|ication)\s+and\s+hold\s+harmless\s+from\s+any\s+and\s+all\s+(?:claims|damages|losses|liabilities)[^.]*\./i);
  const capMatch = clean.match(/(?:aggregate|total)\s+liability\s+(?:shall\s+not\s+exceed|capped\s+at)[^.]*\./i);

  if (uncappedMatch && !capMatch) {
    risks.push({
      id: "risk-liability-uncapped",
      category: "liability",
      title: "Uncapped Indemnification & Unlimited Liability",
      severity: "critical",
      excerpt: uncappedMatch[0].slice(0, 160) + "...",
      explanation:
        "You are agreeing to defend and pay for any and all claims without any dollar ceiling. A single legal dispute could hold you personally liable for damages exceeding your total contract earnings.",
      recommendation:
        "Insert a standard mutual liability cap: 'In no event shall either party's aggregate liability exceed the total fees paid under this Agreement in the preceding 12 months.'",
    });
  }

  // Check B: Automatic Renewal / Evergreen Trap
  const autoRenewMatch = clean.match(/automatically\s+renew(?:s|ed)?\s+for\s+successive\s+(?:terms|periods|one-year)[^.]*\./i);
  const noticeMatch = clean.match(/written\s+notice\s+at\s+least\s+(\d+)\s+days\s+prior\s+to/i);
  if (autoRenewMatch) {
    const days = noticeMatch ? noticeMatch[1] : "60";
    risks.push({
      id: "risk-auto-renewal",
      category: "auto_renewal",
      title: "Automatic Renewal / Evergreen Clause",
      severity: "high",
      excerpt: autoRenewMatch[0].slice(0, 160) + "...",
      explanation: `This contract will automatically renew without explicit re-signing unless you give written cancellation notice at least ${days} days in advance. Missing this window locks you in for another full term.`,
      recommendation:
        "Change to: 'This Agreement shall terminate at the end of the initial term, unless both parties mutually agree in writing to extend.'",
    });
  }

  // Check C: Overreaching Non-Compete
  const nonCompeteMatch = clean.match(/(?:non-compete|shall\s+not\s+engage\s+in|covenant\s+not\s+to\s+compete)[^.]*\./i);
  if (nonCompeteMatch) {
    const durationMatch = clean.match(/(?:period of|for a period of)\s+(\d+\s+(?:months|years))/i);
    const duration = durationMatch ? durationMatch[1] : "1–2 years";
    risks.push({
      id: "risk-non-compete",
      category: "non_compete",
      title: "Restrictive Non-Compete Covenant",
      severity: "high",
      excerpt: nonCompeteMatch[0].slice(0, 160) + "...",
      explanation: `Restricts your ability to work with other clients or start a business in the same industry for ${duration}. This can severely handicap your career or agency income.`,
      recommendation:
        "Strike the non-compete clause entirely, or narrow it strictly to direct solicitation of existing active company clients with whom you worked personally.",
    });
  }

  // Check D: Broad Intellectual Property Forfeiture
  const ipMatch = clean.match(/(?:hereby\s+assigns|exclusive\s+property\s+of\s+company|work\s+made\s+for\s+hire)[^.]*all\s+(?:inventions|intellectual\s+property|works)[^.]*\./i);
  const backgroundIpMatch = clean.match(/(?:retains\s+all\s+rights|pre-existing\s+materials|background\s+technology)/i);
  if (ipMatch && !backgroundIpMatch) {
    risks.push({
      id: "risk-ip-forfeiture",
      category: "ip_rights",
      title: "Broad IP Assignment (Risk of Losing Pre-Existing Tools)",
      severity: "high",
      excerpt: ipMatch[0].slice(0, 160) + "...",
      explanation:
        "The contract transfers all IP created during the engagement without explicitly carving out your pre-existing tools, code libraries, workflows, and templates.",
      recommendation:
        "Add a Pre-Existing IP carve-out: 'Contractor retains all rights to its pre-existing tools, templates, and generic libraries, and grants Client a perpetual non-exclusive license to use them solely as embedded in the Deliverables.'",
    });
  }

  // Check E: Delayed Payment Terms (Net 60 / Net 90)
  const netTermsMatch = clean.match(/\bnet\s+(?:60|90|120)\b/i);
  if (netTermsMatch) {
    risks.push({
      id: "risk-delayed-payment",
      category: "payment",
      title: `Excessive Payment Delay (${netTermsMatch[0].toUpperCase()})`,
      severity: "medium",
      excerpt: `Payment terms specified as ${netTermsMatch[0]}. Client has up to 2-3 months to pay invoices after receipt.`,
      explanation:
        "You are essentially acting as an interest-free bank for the client. Cash flow will be severely delayed.",
      recommendation:
        "Negotiate down to standard Net 15 or Net 30, with a 1.5% monthly late fee clause for overdue payments.",
    });
  }

  // Check F: One-Sided Termination for Convenience
  const termClientMatch = clean.match(/company\s+may\s+terminate\s+(?:at\s+any\s+time|for\s+convenience)[^.]*\./i);
  const termContractorMatch = clean.match(/contractor\s+may\s+terminate\s+(?:at\s+any\s+time|for\s+convenience)[^.]*\./i);
  if (termClientMatch && !termContractorMatch) {
    risks.push({
      id: "risk-one-sided-termination",
      category: "termination",
      title: "One-Sided Termination for Convenience",
      severity: "medium",
      excerpt: termClientMatch[0].slice(0, 160) + "...",
      explanation:
        "The client can cancel the project at any time without cause, but you are not granted an equivalent right to terminate.",
      recommendation:
        "Make termination mutual with 30 days written notice, and guarantee full payment for all work performed up to the termination date.",
    });
  }

  // Check G: Perpetual Confidentiality
  const perpetualMatch = clean.match(/(?:confidentiality\s+obligations\s+shall\s+survive|survive\s+in\s+perpetuity|perpetual\s+obligation)[^.]*\./i);
  if (perpetualMatch) {
    risks.push({
      id: "risk-perpetual-nda",
      category: "confidentiality",
      title: "Perpetual Confidentiality Burden",
      severity: "low",
      excerpt: perpetualMatch[0].slice(0, 150) + "...",
      explanation:
        "You are bound to keep general information secret forever, creating permanent legal exposure unless qualified for trade secrets only.",
      recommendation:
        "Limit general confidentiality to 2 or 3 years following contract termination (with perpetual protection applying strictly to legally recognized trade secrets).",
    });
  }

  // 4. Extract Contract Obligations & Deadlines
  const obligations: ContractObligation[] = [];
  const lines = clean.split(/\r?\n/);

  for (const line of lines) {
    const l = line.trim();
    if (l.length < 20) continue;

    if (/\b(?:shall\s+pay|invoice|compensation|payment)\b/i.test(l) && /\$|\bnet\b|\bdays\b/i.test(l)) {
      obligations.push({
        party: "Client / Paying Party",
        type: "payment",
        description: l.slice(0, 130),
      });
    } else if (/\b(?:shall\s+deliver|deliverables|milestone|schedule)\b/i.test(l) && obligations.length < 5) {
      obligations.push({
        party: "Provider / Contractor",
        type: "deliverable",
        description: l.slice(0, 130),
      });
    } else if (/\b(?:notice\s+of|written\s+notice)\b/i.test(l) && /\b\d+\s+days\b/i.test(l) && obligations.length < 6) {
      obligations.push({
        party: "Both Parties",
        type: "notice",
        description: l.slice(0, 130),
      });
    }
  }

  // 5. Calculate Risk Score & Fairness
  // Severity weights: critical = 30, high = 20, medium = 12, low = 5
  let riskScore = 15;
  for (const r of risks) {
    if (r.severity === "critical") riskScore += 30;
    else if (r.severity === "high") riskScore += 20;
    else if (r.severity === "medium") riskScore += 12;
    else if (r.severity === "low") riskScore += 5;
  }
  riskScore = Math.min(100, Math.max(10, riskScore));

  let riskRating: RiskLevel = "low";
  if (riskScore >= 70) riskRating = "critical";
  else if (riskScore >= 50) riskRating = "high";
  else if (riskScore >= 30) riskRating = "medium";

  const fairnessScore = Math.max(10, Math.min(95, 100 - Math.round(riskScore * 0.85)));

  // 6. Executive Summary & Pros / Cons
  const executiveSummary: string[] = [
    `Agreement classified as a ${contractType} under ${governingLaw || "standard state commercial jurisdiction"}.`,
    risks.length > 0
      ? `Identified ${risks.length} legal risks (${risks.filter((r) => r.severity === "critical" || r.severity === "high").length} high-severity items requiring negotiation).`
      : "No critical red flags detected; contract language adheres to standard balanced commercial norms.",
    obligations.length > 0
      ? `Outlines ${obligations.length} primary operational milestones and payment obligations.`
      : "Standard general obligations structure.",
  ];

  const pros: string[] = [];
  const cons: string[] = [];

  if (capMatch) pros.push("Includes a defined liability cap protecting against catastrophic damages.");
  else cons.push("Lacks a clear dollar liability cap.");

  if (backgroundIpMatch) pros.push("Explicitly safeguards pre-existing IP and proprietary tools.");
  else cons.push("Broad IP transfer without protective pre-existing tool carve-out.");

  if (!nonCompeteMatch) pros.push("No restrictive non-compete clause; preserves freedom to serve other clients.");
  else cons.push("Contains restrictive non-compete limiting industry work.");

  if (!autoRenewMatch) pros.push("Terminates cleanly at period end without automatic renewal traps.");
  else cons.push("Automatic renewal clause locks in subsequent terms unless advance notice is provided.");

  if (pros.length === 0) pros.push("Clear governing jurisdiction and scope outline.");
  if (cons.length === 0) cons.push("Standard boilerplate terms.");

  return {
    contractType,
    overallRiskScore: riskScore,
    riskRating,
    executiveSummary,
    governingLaw,
    effectiveDate,
    partiesDetected: parties,
    risks,
    obligations,
    fairnessScore,
    pros,
    cons,
  };
}

export const SAMPLE_CONTRACT_TEXT = `MASTER SERVICES & INDEPENDENT CONTRACTOR AGREEMENT

This Master Services Agreement ("Agreement") is dated as of October 1, 2026 ("Effective Date"), by and between Apex Global Media LLC ("Company"), and Alex Mercer ("Contractor").

1. SCOPE OF SERVICES
Contractor shall perform the digital design, software development, and technical consulting services set forth in executed Statements of Work (SOW).

2. COMPENSATION & PAYMENT TERMS
Company shall pay Contractor the hourly or fixed project fees described in each SOW. Contractor shall submit monthly invoices. Payment terms shall be Net 60 days following Company's written approval of all deliverables. Company reserves the right in its sole discretion to withhold 20% of invoice totals until final project completion.

3. TERM AND AUTOMATIC RENEWAL
The initial term of this Agreement shall be twelve (12) months. This Agreement shall automatically renew for successive one-year periods unless Contractor provides written notice of termination at least sixty (60) days prior to the expiration of the then-current term. Company may terminate this Agreement at any time for convenience upon five (5) days written notice.

4. INTELLECTUAL PROPERTY ASSIGNMENT
Contractor hereby irrevocably assigns, transfers, and conveys to Company all right, title, and interest in and to all inventions, software code, designs, algorithms, works of authorship, and deliverables created or developed during the term of this Agreement, without exception. Contractor waives all moral rights in perpetuity.

5. NON-COMPETE & NON-SOLICITATION
During the term of this Agreement and for a period of eighteen (18) months following termination for any reason, Contractor shall not engage in, consult for, or provide similar services to any business or entity that competes directly or indirectly with Company within North America.

6. INDEMNIFICATION & LIMITATION OF LIABILITY
Contractor agrees to defend, indemnify, and hold harmless Company, its officers, directors, and affiliates from and against any and all claims, liabilities, losses, damages, costs, and expenses (including attorney's fees) arising out of or resulting from Contractor's services or breach of this Agreement. Contractor's liability under this section shall be uncapped and unlimited.

7. CONFIDENTIALITY
Contractor agrees that all proprietary information, client lists, and technical data shall remain strictly confidential in perpetuity.

8. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflicts of law principles.`;
