/**
 * Smart Document Compare & Contract Diff Engine
 *
 * Computes word-by-word and line-by-line differences between Document A and Document B.
 * Identifies high-risk clause modifications (payments, dates, liability, termination).
 */

export interface DiffToken {
  type: "added" | "removed" | "unchanged";
  value: string;
}

export interface DiffLine {
  lineA?: string;
  lineB?: string;
  type: "added" | "removed" | "modified" | "unchanged";
  tokensA?: DiffToken[];
  tokensB?: DiffToken[];
}

export interface ContractRiskAlert {
  category: "payment" | "liability" | "deadline" | "clause";
  severity: "high" | "medium" | "low";
  description: string;
  snippetA?: string;
  snippetB?: string;
}

export interface DocumentDiffResult {
  similarityScore: number; // 0 to 100%
  totalLinesA: number;
  totalLinesB: number;
  addedLinesCount: number;
  removedLinesCount: number;
  modifiedLinesCount: number;
  unchangedLinesCount: number;
  diffLines: DiffLine[];
  riskAlerts: ContractRiskAlert[];
}

/**
 * Longest Common Subsequence (LCS) for token arrays
 */
function computeTokenLcs(a: string[], b: string[]): DiffToken[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (a[i] === b[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffToken[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: "unchanged", value: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", value: b[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({ type: "removed", value: a[i - 1] });
      i--;
    }
  }

  return result;
}

/**
 * Compare two text documents and produce line/word diffs and risk alerts
 */
export function compareDocuments(textA: string, textB: string): DocumentDiffResult {
  const linesA = textA.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const linesB = textB.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const m = linesA.length;
  const n = linesB.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesA[i] === linesB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diffLines: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      diffLines.unshift({
        type: "unchanged",
        lineA: linesA[i - 1],
        lineB: linesB[j - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.unshift({
        type: "added",
        lineB: linesB[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffLines.unshift({
        type: "removed",
        lineA: linesA[i - 1],
      });
      i--;
    }
  }

  // Look for paired added/removed lines and mark them as modified with word-level diffs
  for (let k = 0; k < diffLines.length - 1; k++) {
    if (diffLines[k].type === "removed" && diffLines[k + 1].type === "added") {
      const wordsA = (diffLines[k].lineA || "").split(/\s+/);
      const wordsB = (diffLines[k + 1].lineB || "").split(/\s+/);
      const tokenDiff = computeTokenLcs(wordsA, wordsB);

      diffLines[k] = {
        type: "modified",
        lineA: diffLines[k].lineA,
        lineB: diffLines[k + 1].lineB,
        tokensA: tokenDiff.filter((t) => t.type !== "added"),
        tokensB: tokenDiff.filter((t) => t.type !== "removed"),
      };
      diffLines.splice(k + 1, 1);
    }
  }

  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;

  for (const line of diffLines) {
    if (line.type === "added") added++;
    else if (line.type === "removed") removed++;
    else if (line.type === "modified") modified++;
    else if (line.type === "unchanged") unchanged++;
  }

  // Compute similarity score
  const total = m + n;
  const similarityScore = total === 0 ? 100 : Math.round(((unchanged * 2) / total) * 100);

  // Scan for high-impact contract risk changes (numbers, dates, liability clauses)
  const riskAlerts: ContractRiskAlert[] = [];

  const moneyPattern = /\$[\d,]+(?:\.\d{2})?|\b\d+\s*(?:dollars|usd|euros|eur|gbp)\b/i;
  const liabilityPattern = /\b(liability|indemnif|warrant|terminate|breach|penalt|liquidated damages)\b/i;
  const deadlinePattern = /\b(days|months|notice|within\s+\d+|deadline|prior to)\b/i;

  for (const line of diffLines) {
    if (line.type === "modified" || line.type === "added" || line.type === "removed") {
      const text = `${line.lineA || ""} ${line.lineB || ""}`;

      if (moneyPattern.test(text)) {
        riskAlerts.push({
          category: "payment",
          severity: "high",
          description: "Payment terms, compensation, or monetary numbers were modified.",
          snippetA: line.lineA,
          snippetB: line.lineB,
        });
      } else if (liabilityPattern.test(text)) {
        riskAlerts.push({
          category: "liability",
          severity: "high",
          description: "Liability cap, indemnification, or warranty provisions altered.",
          snippetA: line.lineA,
          snippetB: line.lineB,
        });
      } else if (deadlinePattern.test(text)) {
        riskAlerts.push({
          category: "deadline",
          severity: "medium",
          description: "Notice period, timeline, or termination deadline modified.",
          snippetA: line.lineA,
          snippetB: line.lineB,
        });
      }
    }
  }

  return {
    similarityScore,
    totalLinesA: m,
    totalLinesB: n,
    addedLinesCount: added,
    removedLinesCount: removed,
    modifiedLinesCount: modified,
    unchangedLinesCount: unchanged,
    diffLines,
    riskAlerts: riskAlerts.slice(0, 10), // top 10 alerts
  };
}
