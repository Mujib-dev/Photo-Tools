/**
 * AI Resume & ATS Score Optimizer Engine
 *
 * Simulates enterprise Applicant Tracking Systems (Workday, Taleo, Greenhouse, Lever, iCIMS):
 * 1. Keyword Frequency & Hard/Soft Skill Gap Analysis
 * 2. Section Readability & Standard Hierarchy Validation
 * 3. Bullet Point Impact & Action Verb Optimization (Google X-Y-Z formula)
 * 4. ATS Compatibility & Contact Hygiene
 */

export interface AtsKeywordMatch {
  keyword: string;
  category: "hard_skill" | "soft_skill" | "tool_tech" | "certification" | "education";
  importance: "high" | "medium" | "low";
  foundInResume: boolean;
  frequencyInJob: number;
  frequencyInResume: number;
}

export interface BulletImprovement {
  original: string;
  improved: string;
  score: number; // 0-100
  critique: string;
  actionVerbUsed: string;
  metricAdded: boolean;
}

export interface AtsSectionScore {
  name: string;
  score: number; // 0-100
  weight: number;
  status: "excellent" | "good" | "needs_work" | "critical";
  feedback: string;
  passedChecks: string[];
  failedChecks: string[];
}

export interface AtsAnalysisResult {
  overallScore: number; // 0-100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  summary: string;
  targetRole: string;
  sections: AtsSectionScore[];
  keywords: AtsKeywordMatch[];
  matchedKeywordsCount: number;
  totalJobKeywordsCount: number;
  bulletImprovements: BulletImprovement[];
  formattingChecks: {
    hasContactInfo: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
    hasLinkedInOrPortfolio: boolean;
    wordCount: number;
    recommendedWordCount: { min: number; max: number };
    bulletCount: number;
    hasStandardHeadings: boolean;
  };
  actionableRecommendations: string[];
}

const COMMON_SKILLS_DICTIONARY: Record<
  string,
  { category: AtsKeywordMatch["category"]; importance: AtsKeywordMatch["importance"] }
> = {
  // Hard Skills & Programming
  react: { category: "tool_tech", importance: "high" },
  "next.js": { category: "tool_tech", importance: "high" },
  typescript: { category: "hard_skill", importance: "high" },
  javascript: { category: "hard_skill", importance: "high" },
  python: { category: "hard_skill", importance: "high" },
  "node.js": { category: "tool_tech", importance: "high" },
  sql: { category: "hard_skill", importance: "high" },
  postgresql: { category: "tool_tech", importance: "medium" },
  mongodb: { category: "tool_tech", importance: "medium" },
  docker: { category: "tool_tech", importance: "high" },
  kubernetes: { category: "tool_tech", importance: "high" },
  aws: { category: "tool_tech", importance: "high" },
  azure: { category: "tool_tech", importance: "medium" },
  gcp: { category: "tool_tech", importance: "medium" },
  "ci/cd": { category: "hard_skill", importance: "high" },
  git: { category: "tool_tech", importance: "high" },
  graphql: { category: "hard_skill", importance: "medium" },
  "rest api": { category: "hard_skill", importance: "high" },
  microservices: { category: "hard_skill", importance: "high" },
  "system design": { category: "hard_skill", importance: "high" },
  "unit testing": { category: "hard_skill", importance: "medium" },
  tailwind: { category: "tool_tech", importance: "medium" },
  linux: { category: "hard_skill", importance: "medium" },
  terraform: { category: "tool_tech", importance: "medium" },
  redis: { category: "tool_tech", importance: "medium" },
  kafka: { category: "tool_tech", importance: "medium" },
  java: { category: "hard_skill", importance: "high" },
  "c++": { category: "hard_skill", importance: "medium" },
  golang: { category: "hard_skill", importance: "high" },
  rust: { category: "hard_skill", importance: "medium" },

  // AI & Data
  "machine learning": { category: "hard_skill", importance: "high" },
  "deep learning": { category: "hard_skill", importance: "medium" },
  pytorch: { category: "tool_tech", importance: "high" },
  tensorflow: { category: "tool_tech", importance: "high" },
  nlp: { category: "hard_skill", importance: "medium" },
  "large language models": { category: "hard_skill", importance: "high" },
  llms: { category: "hard_skill", importance: "high" },
  pandas: { category: "tool_tech", importance: "medium" },
  numpy: { category: "tool_tech", importance: "medium" },
  tableau: { category: "tool_tech", importance: "medium" },
  "power bi": { category: "tool_tech", importance: "medium" },
  analytics: { category: "hard_skill", importance: "high" },

  // Product, Design & Methodology
  agile: { category: "hard_skill", importance: "high" },
  scrum: { category: "hard_skill", importance: "medium" },
  jira: { category: "tool_tech", importance: "medium" },
  figma: { category: "tool_tech", importance: "high" },
  "ui/ux": { category: "hard_skill", importance: "high" },
  wireframing: { category: "hard_skill", importance: "medium" },
  prototyping: { category: "hard_skill", importance: "medium" },
  "product roadmap": { category: "hard_skill", importance: "high" },
  "a/b testing": { category: "hard_skill", importance: "high" },

  // Soft Skills
  leadership: { category: "soft_skill", importance: "high" },
  communication: { category: "soft_skill", importance: "high" },
  collaboration: { category: "soft_skill", importance: "high" },
  "cross-functional": { category: "soft_skill", importance: "high" },
  mentorship: { category: "soft_skill", importance: "medium" },
  "problem solving": { category: "soft_skill", importance: "high" },
  "stakeholder management": { category: "soft_skill", importance: "high" },
  "strategic planning": { category: "soft_skill", importance: "high" },
  negotiation: { category: "soft_skill", importance: "medium" },

  // Certifications & Education
  pmp: { category: "certification", importance: "high" },
  csm: { category: "certification", importance: "medium" },
  cissp: { category: "certification", importance: "high" },
  "aws certified": { category: "certification", importance: "high" },
  "bachelor's": { category: "education", importance: "high" },
  "master's": { category: "education", importance: "medium" },
  mba: { category: "education", importance: "medium" },
};

const STRONG_ACTION_VERBS = [
  "Accelerated",
  "Architected",
  "Spearheaded",
  "Engineered",
  "Pioneered",
  "Orchestrated",
  "Designed",
  "Streamlined",
  "Maximized",
  "Transformed",
  "Implemented",
  "Delivered",
  "Surpassed",
  "Formulated",
  "Revamped",
];

const WEAK_VERB_PATTERNS = [
  { pattern: /^(responsible for|was responsible for)\s+/i, replacement: "Spearheaded and directed " },
  { pattern: /^(assisted with|helped with|helped to)\s+/i, replacement: "Collaborated to engineer and deliver " },
  { pattern: /^(worked on|worked with)\s+/i, replacement: "Architected and deployed " },
  { pattern: /^(handled|managed to)\s+/i, replacement: "Streamlined operations and oversaw " },
  { pattern: /^(duties included|tasks involved)\s+/i, replacement: "Executed mission-critical " },
];

export function analyzeResumeATS(resumeText: string, jobDescriptionText: string): AtsAnalysisResult {
  const cleanResume = resumeText.trim();
  const cleanJob = jobDescriptionText.trim();
  const resumeLower = cleanResume.toLowerCase();
  const jobLower = cleanJob.toLowerCase();

  // 1. Extract Target Role
  let targetRole = "Target Role";
  const titleMatch = cleanJob.match(/(?:title|role|position|looking for a|seeking an?)\s*[:\-–]?\s*([A-Za-z0-9\s/]+)/i);
  if (titleMatch && titleMatch[1]) {
    targetRole = titleMatch[1].split("\n")[0].trim().slice(0, 40);
  } else {
    const firstLine = cleanJob.split("\n")[0].trim();
    if (firstLine.length > 3 && firstLine.length < 50) {
      targetRole = firstLine;
    }
  }

  // 2. Keyword & Skills Matching
  const keywordMatches: AtsKeywordMatch[] = [];
  let totalJobKeywords = 0;
  let matchedJobKeywords = 0;

  for (const [kw, meta] of Object.entries(COMMON_SKILLS_DICTIONARY)) {
    // Regex word boundary match
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");

    const jobMatches = jobLower.match(regex);
    const resumeMatches = resumeLower.match(regex);

    const freqJob = jobMatches ? jobMatches.length : 0;
    const freqResume = resumeMatches ? resumeMatches.length : 0;

    if (freqJob > 0) {
      totalJobKeywords++;
      const isFound = freqResume > 0;
      if (isFound) matchedJobKeywords++;

      keywordMatches.push({
        keyword: kw,
        category: meta.category,
        importance: meta.importance,
        foundInResume: isFound,
        frequencyInJob: freqJob,
        frequencyInResume: freqResume,
      });
    }
  }

  // Also extract capitalized acronyms / technical phrases from job description
  const customAcronyms = cleanJob.match(/\b[A-Z]{2,6}\b/g) || [];
  const uniqueAcronyms = Array.from(new Set(customAcronyms)).filter(
    (a) => !["AND", "THE", "FOR", "WITH", "ARE", "YOU", "OUR", "ALL", "NEW", "NOT"].includes(a)
  );

  for (const acr of uniqueAcronyms.slice(0, 8)) {
    if (!keywordMatches.some((k) => k.keyword.toLowerCase() === acr.toLowerCase())) {
      const regex = new RegExp(`\\b${acr}\\b`, "gi");
      const jobCount = (cleanJob.match(regex) || []).length;
      const resCount = (cleanResume.match(regex) || []).length;

      if (jobCount >= 1) {
        totalJobKeywords++;
        if (resCount > 0) matchedJobKeywords++;
        keywordMatches.push({
          keyword: acr,
          category: "hard_skill",
          importance: "medium",
          foundInResume: resCount > 0,
          frequencyInJob: jobCount,
          frequencyInResume: resCount,
        });
      }
    }
  }

  // Sort keywords: missing first, then high importance
  keywordMatches.sort((a, b) => {
    if (a.foundInResume !== b.foundInResume) return a.foundInResume ? 1 : -1;
    const impWeight = { high: 3, medium: 2, low: 1 };
    return impWeight[b.importance] - impWeight[a.importance];
  });

  // 3. Formatting & Hygiene Checks
  const emailMatch = cleanResume.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = cleanResume.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const linkedinMatch = cleanResume.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+|github\.com\/[a-zA-Z0-9_-]+/i);

  const wordCount = cleanResume.split(/\s+/).filter(Boolean).length;
  const rawBullets = cleanResume
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-•*–—]|\d+\.\s+/.test(l) || (l.length > 25 && l.endsWith(".")));

  const standardHeadings = ["experience", "education", "skills", "projects", "summary", "certifications"];
  const foundHeadings = standardHeadings.filter((h) => new RegExp(`\\b${h}\\b`, "i").test(cleanResume));

  const formattingChecks = {
    hasContactInfo: !!(emailMatch && phoneMatch),
    hasEmail: !!emailMatch,
    hasPhone: !!phoneMatch,
    hasLinkedInOrPortfolio: !!linkedinMatch,
    wordCount,
    recommendedWordCount: { min: 400, max: 850 },
    bulletCount: rawBullets.length,
    hasStandardHeadings: foundHeadings.length >= 3,
  };

  // 4. Bullet Point Analysis & Rewriting (Google X-Y-Z formula)
  const bulletImprovements: BulletImprovement[] = [];
  const candidateBullets = rawBullets.slice(0, 6);

  for (let i = 0; i < candidateBullets.length; i++) {
    const raw = candidateBullets[i].replace(/^[-•*–—]\s*|\d+\.\s*/, "").trim();
    if (raw.length < 15) continue;

    let improved = raw;
    let actionVerbUsed = STRONG_ACTION_VERBS[i % STRONG_ACTION_VERBS.length];
    let critique = "Good foundation, but lacks measurable business impact or quantifiable metrics.";
    let metricAdded = false;

    // Check for weak openings
    for (const weak of WEAK_VERB_PATTERNS) {
      if (weak.pattern.test(raw)) {
        improved = raw.replace(weak.pattern, weak.replacement);
        actionVerbUsed = weak.replacement.split(" ")[0];
        critique = "Replaced passive phrasing with an assertive high-impact action verb.";
        break;
      }
    }

    // Check if numbers/metrics exist
    const hasNumbers = /\d+%?|\$\d+|\d+x/i.test(raw);
    if (!hasNumbers) {
      // Inject standard quantifiable achievement placeholder
      const metrics = [
        "boosting system performance by 34% and cutting latency by 120ms",
        "reducing operational overhead by $45,000 annually",
        "increasing user engagement and retention by 28%",
        "accelerating delivery cycle velocity by 2.5x across 12 releases",
      ];
      const metric = metrics[i % metrics.length];
      improved = `${improved.replace(/\.?$/, "")}, ${metric}.`;
      metricAdded = true;
      critique += " Added quantifiable outcome to prove concrete ROI.";
    }

    bulletImprovements.push({
      original: raw,
      improved,
      score: hasNumbers ? 82 : 45,
      critique,
      actionVerbUsed,
      metricAdded,
    });
  }

  // 5. Section Scoring Breakdown
  // Section A: Hard Skills Match (Weight 35)
  const skillRatio = totalJobKeywords > 0 ? matchedJobKeywords / totalJobKeywords : 0.65;
  const skillScore = Math.min(100, Math.round(skillRatio * 100));

  const hardSkillsSection: AtsSectionScore = {
    name: "Hard Skills & Keywords Match",
    score: skillScore,
    weight: 35,
    status: skillScore >= 80 ? "excellent" : skillScore >= 60 ? "good" : skillScore >= 40 ? "needs_work" : "critical",
    feedback:
      skillScore >= 75
        ? "Excellent alignment with role requirements."
        : `Missing ${totalJobKeywords - matchedJobKeywords} key technical proficiencies required by the job posting.`,
    passedChecks: keywordMatches.filter((k) => k.foundInResume).map((k) => `Matched: ${k.keyword}`),
    failedChecks: keywordMatches.filter((k) => !k.foundInResume).map((k) => `Missing: ${k.keyword}`),
  };

  // Section B: Impact & Measurable Metrics (Weight 25)
  const metricsCount = (cleanResume.match(/\b\d+(?:%|k|m|x|\+)?\b|\$\d+/gi) || []).length;
  const impactScore = Math.min(100, Math.max(30, Math.round((metricsCount / 8) * 100)));
  const impactSection: AtsSectionScore = {
    name: "Impact & Quantifiable Metrics",
    score: impactScore,
    weight: 25,
    status: impactScore >= 75 ? "excellent" : impactScore >= 55 ? "good" : "needs_work",
    feedback:
      impactScore >= 75
        ? "Great use of percentages, dollar amounts, and metrics to demonstrate value."
        : "Several bullet points lack measurable results ($ revenue, % efficiency, hours saved).",
    passedChecks: [`Found ${metricsCount} quantified metrics and data points`],
    failedChecks: impactScore < 70 ? ["Recommend at least 1-2 numbers per bullet point"] : [],
  };

  // Section C: ATS Formatting & Clean Structure (Weight 20)
  let formatScore = 40;
  const passedFmt: string[] = [];
  const failedFmt: string[] = [];

  if (formattingChecks.hasEmail) {
    formatScore += 15;
    passedFmt.push("Professional email address found");
  } else failedFmt.push("Missing contact email address");

  if (formattingChecks.hasPhone) {
    formatScore += 15;
    passedFmt.push("Phone number detected");
  } else failedFmt.push("Missing phone number");

  if (formattingChecks.hasLinkedInOrPortfolio) {
    formatScore += 10;
    passedFmt.push("LinkedIn or portfolio link present");
  } else failedFmt.push("Missing LinkedIn URL or personal website");

  if (wordCount >= 350 && wordCount <= 900) {
    formatScore += 10;
    passedFmt.push(`Optimal word count (${wordCount} words)`);
  } else {
    failedFmt.push(`Word count (${wordCount}) outside sweet spot (400-850 words)`);
  }

  if (formattingChecks.hasStandardHeadings) {
    formatScore += 10;
    passedFmt.push("Standard ATS-friendly section headers detected");
  } else {
    failedFmt.push("Non-standard section titles may confuse ATS parsers");
  }

  formatScore = Math.min(100, formatScore);
  const formattingSection: AtsSectionScore = {
    name: "ATS Parseability & Layout",
    score: formatScore,
    weight: 20,
    status: formatScore >= 80 ? "excellent" : formatScore >= 60 ? "good" : "needs_work",
    feedback: formatScore >= 80 ? "Clean, single-column friendly format." : "Formatting improvements needed.",
    passedChecks: passedFmt,
    failedChecks: failedFmt,
  };

  // Section D: Role Alignment & Brevity (Weight 20)
  const roleScore = Math.min(
    100,
    Math.round((skillScore * 0.5) + (rawBullets.length >= 8 ? 40 : rawBullets.length * 5) + 10)
  );
  const roleSection: AtsSectionScore = {
    name: "Role & Experience Relevance",
    score: roleScore,
    weight: 20,
    status: roleScore >= 75 ? "excellent" : roleScore >= 55 ? "good" : "needs_work",
    feedback: "Evaluates overall alignment with experience expectations and duty scope.",
    passedChecks: [`Extracted ${rawBullets.length} experience bullet items`],
    failedChecks: rawBullets.length < 5 ? ["Add more detailed experience items"] : [],
  };

  // 6. Overall Weighted Score Calculation
  const overallScore = Math.round(
    (hardSkillsSection.score * 0.35) +
    (impactSection.score * 0.25) +
    (formattingSection.score * 0.2) +
    (roleSection.score * 0.2)
  );

  let grade: AtsAnalysisResult["grade"] = "F";
  if (overallScore >= 92) grade = "A+";
  else if (overallScore >= 84) grade = "A";
  else if (overallScore >= 74) grade = "B";
  else if (overallScore >= 62) grade = "C";
  else if (overallScore >= 50) grade = "D";

  // Actionable recommendations list
  const actionableRecommendations: string[] = [];
  const missingHigh = keywordMatches.filter((k) => !k.foundInResume && k.importance === "high").map((k) => k.keyword);
  if (missingHigh.length > 0) {
    actionableRecommendations.push(
      `Add critical missing keywords: ${missingHigh.slice(0, 5).join(", ")} directly into your experience or skills section.`
    );
  }
  if (!formattingChecks.hasLinkedInOrPortfolio) {
    actionableRecommendations.push("Include your LinkedIn profile link or GitHub/portfolio at the top header.");
  }
  if (impactScore < 70) {
    actionableRecommendations.push("Quantify at least 3 bullet points with hard percentages (%), dollars ($), or team sizes.");
  }
  if (wordCount < 400) {
    actionableRecommendations.push("Expand on specific project accomplishments to reach the optimal 400–800 word range.");
  } else if (wordCount > 900) {
    actionableRecommendations.push("Trim older or redundant experience to ensure your resume fits within 1–2 pages.");
  }

  return {
    overallScore,
    grade,
    summary:
      overallScore >= 80
        ? "Strong candidate profile! Your resume passes the majority of ATS screening gates with high keyword alignment."
        : overallScore >= 65
        ? "Moderate ATS match. You have core qualifications, but missing critical role-specific keywords and quantifiable metrics."
        : "High risk of rejection by automated ATS filters. Significant keyword gaps and passive phrasing detected.",
    targetRole,
    sections: [hardSkillsSection, impactSection, formattingSection, roleSection],
    keywords: keywordMatches,
    matchedKeywordsCount: matchedJobKeywords,
    totalJobKeywordsCount: totalJobKeywords,
    bulletImprovements,
    formattingChecks,
    actionableRecommendations,
  };
}

export const SAMPLE_RESUME_TEXT = `Jane Doe
Senior Full-Stack Engineer | San Francisco, CA
jane.doe@example.com | (555) 234-5678 | linkedin.com/in/janedoe | github.com/janedoe

PROFESSIONAL SUMMARY
Results-driven software engineer with 6+ years of experience building scalable web applications and distributed cloud systems using React, TypeScript, and Node.js.

PROFESSIONAL EXPERIENCE

Senior Software Engineer | CloudScale Inc.
2022 - Present | San Francisco, CA
• Responsible for architecting and deploying core microservices using Node.js, Express, and PostgreSQL.
• Worked on the frontend migration to React, Next.js, and TypeScript, improving page load times.
• Helped with CI/CD pipeline automation and Docker containerization on AWS ECS.
• Mentored junior engineers and conducted daily code reviews to ensure system reliability.

Full-Stack Developer | FinTech Nexus
2019 - 2022 | Austin, TX
• Developed customer-facing financial dashboards using JavaScript, React, and REST APIs.
• Handled database queries and optimized SQL queries to reduce response times.
• Assisted with third-party payment gateway integration and authentication systems.
• Participated in agile scrum ceremonies and sprint planning.

EDUCATION
Bachelor of Science in Computer Science | University of Texas at Austin

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, SQL, HTML, CSS
Frameworks & Tools: React, Next.js, Node.js, Docker, Git, AWS, Tailwind CSS, PostgreSQL, Jest`;

export const SAMPLE_JOB_DESCRIPTION = `Job Title: Senior Full-Stack Engineer (React & Cloud)
Company: TechVentures Global
Location: Remote / Hybrid

About the Role:
We are seeking a Senior Full-Stack Engineer to architect and scale our next-generation cloud analytics platform.

Key Responsibilities:
• Lead the design and development of modern web applications using React, Next.js, and TypeScript.
• Build and scale robust backend microservices with Node.js, GraphQL, and PostgreSQL.
• Deploy scalable containerized workloads using Docker, Kubernetes, and AWS (Amazon Web Services).
• Champion engineering best practices, CI/CD automation, unit testing, and agile methodologies.
• Collaborate cross-functionally with product managers, UI/UX designers, and stakeholders.

Qualifications & Requirements:
• 5+ years of full-stack software development experience.
• Deep proficiency in TypeScript, React, Next.js, Node.js, and REST APIs.
• Strong experience with cloud architectures on AWS (ECS, S3, RDS), Docker, and Kubernetes.
• Solid background in database performance tuning with SQL and PostgreSQL.
• Excellent communication, leadership, and problem solving skills.
• Bachelor's degree in Computer Science or equivalent practical experience.`;
