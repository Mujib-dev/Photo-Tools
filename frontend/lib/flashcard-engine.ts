/**
 * AI Flashcard & Study Quiz Engine — Quizlet & Anki Grade Edition
 * ==============================================================
 * Automatically converts lecture notes, textbooks, study guides, and articles
 * into high-yield active-recall question & answer flashcard decks.
 *
 * Reverse-engineered from commercial active-recall cognitive algorithms:
 *   1. Concept & Definition extraction (Term: Definition, Term = Definition, Markdown bolding)
 *   2. Natural Language Copula mining ("X is defined as...", "X refers to...", "X is a framework that...")
 *   3. Purpose & Function query generation ("The primary purpose of X is to...")
 *   4. Causal & Mechanism query generation ("X occurs when...", "X works by...")
 *   5. Contrast & Differentiation query generation ("Unlike X, which..., Y...")
 *   6. Composition & Component queries ("X consists of...", "X comprises...")
 *   7. Active-Recall Cloze (Fill-in-the-blank) for declarative factual statements
 *   8. Automatic question phrasing polish with natural conversational tone
 */

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category?: string;
  mastered?: boolean;
}

export const SAMPLE_DECKS: Record<string, { title: string; cards: Flashcard[] }> = {
  cs: {
    title: "Computer Science & Web Architecture",
    cards: [
      {
        id: "card-1",
        question: "What is an Application Programming Interface (API)?",
        answer: "A set of protocols and definitions that allow different software programs to communicate and exchange data seamlessly.",
        category: "Architecture",
      },
      {
        id: "card-2",
        question: "What is the key difference between TCP and UDP?",
        answer: "TCP is connection-oriented, guaranteed, and sequenced. UDP is connectionless, fast, and prioritized for real-time video and gaming without retries.",
        category: "Networking",
      },
      {
        id: "card-3",
        question: "What is a Closure in JavaScript?",
        answer: "A function bundled with references to its lexical scope, allowing it to access outer variables even after the outer function has executed.",
        category: "Programming",
      },
      {
        id: "card-4",
        question: "What does WCAG stand for in web accessibility?",
        answer: "Web Content Accessibility Guidelines — the global standard for making digital content accessible to people with disabilities.",
        category: "Standards",
      },
      {
        id: "card-5",
        question: "How does Public-key cryptography work?",
        answer: "By utilizing an asymmetric pair of mathematically linked keys: a public key for encryption and a private key kept secret for decryption and digital signing.",
        category: "Security",
      },
    ],
  },
  business: {
    title: "Business & Startup Strategy",
    cards: [
      {
        id: "card-b1",
        question: "What is Customer Acquisition Cost (CAC)?",
        answer: "The total sales and marketing expenditure required to acquire a single paying customer over a given period.",
        category: "Metrics",
      },
      {
        id: "card-b2",
        question: "What is Churn Rate?",
        answer: "The percentage of subscribers or customers who cancel or do not renew their subscriptions over a given time period.",
        category: "Metrics",
      },
      {
        id: "card-b3",
        question: "What is a Minimum Viable Product (MVP)?",
        answer: "A version of a product with just enough core features to attract early-adopter customers and validate product-market fit with minimal effort.",
        category: "Product",
      },
      {
        id: "card-b4",
        question: "What is the difference between Burn Rate and Runway?",
        answer: "Burn Rate is the net amount of cash a startup spends each month, while Runway is the number of months the company can survive before running out of money.",
        category: "Finance",
      },
    ],
  },
  science: {
    title: "General Science & Biology",
    cards: [
      {
        id: "card-s1",
        question: "What is Photosynthesis?",
        answer: "The biological process by which green plants and certain organisms use sunlight to synthesize nutrients from carbon dioxide and water, releasing oxygen as a byproduct.",
        category: "Biology",
      },
      {
        id: "card-s2",
        question: "What is the primary function of the Mitochondria?",
        answer: "To generate adenosine triphosphate (ATP), the primary energy currency used for cellular metabolic processes.",
        category: "Cell Biology",
      },
      {
        id: "card-s3",
        question: "How does Meiosis differ from Mitosis?",
        answer: "Mitosis produces two genetically identical diploid somatic cells, whereas meiosis produces four genetically diverse haploid gametes (egg or sperm).",
        category: "Genetics",
      },
    ],
  },
};

/**
 * Clean up markdown, bullet markers, and leading punctuation from a term or text
 */
function cleanTerm(term: string): string {
  return term
    .replace(/^[*#•\-–—\d.)\s]+/, "")
    .replace(/[*_`]/g, "")
    .replace(/[:\-–—=]+$/, "")
    .trim();
}

/**
 * Format a term into a natural, grammatically correct study question
 */
function formatTermQuestion(rawTerm: string): string {
  const term = cleanTerm(rawTerm);
  if (!term) return "What is this concept?";

  // If already ends with a question mark, keep it clean
  if (term.endsWith("?")) return term;

  // Acronym detection: e.g. "DNS", "RAM", "CPU", "HTML", "REST API"
  if (/^[A-Z0-9\s/]{2,8}$/.test(term)) {
    return `What is ${term} and what does it stand for?`;
  }

  // Acronym with expansion: e.g. "DNA (Deoxyribonucleic Acid)" -> "What is DNA (Deoxyribonucleic Acid)?"
  if (/\([A-Za-z\s-]+\)/.test(term)) {
    return `What is ${term}?`;
  }

  // Plural concepts: e.g. "Neural Networks", "Ribosomes", "Microservices"
  // Exclude singular words ending in s (e.g. "Photosynthesis", "Economics", "Analysis", "Process")
  if (/s$/i.test(term) && !/ss$|sis$|tis$|ous$|ics$|analysis$|basis$|crisis$/i.test(term)) {
    return `What are ${term}?`;
  }

  return `What is ${term}?`;
}

/**
 * Clean and polish an answer string
 */
function cleanAnswer(ans: string): string {
  let a = ans
    .replace(/^[:\-–—=\s]+/, "")
    .replace(/^[*_`]+|[*_`]+$/g, "")
    .trim();

  // Capitalize first letter
  if (a.length > 0) {
    a = a.charAt(0).toUpperCase() + a.slice(1);
  }

  // Ensure it ends with punctuation if it's a complete statement
  if (a.length > 15 && !/[.!?]$/.test(a)) {
    a += ".";
  }

  return a;
}

/**
 * Identify a key technical / conceptual noun phrase in a sentence for Cloze deletion
 */
function findClozeTarget(sentence: string): { keyword: string; blanked: string } | null {
  // Candidate patterns: Quoted terms, proper noun phrases, acronyms, or technical suffix terms
  const candidates: RegExp[] = [
    /"([^"]{3,35})"/,
    /'([^']{3,35})'/,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/, // Proper Noun phrases (e.g. "Adenosine Triphosphate")
    /\b([A-Z]{2,8})\b/, // Acronyms (e.g. "ATP", "DNA", "SaaS")
    /\b([a-z]{4,20}(?:tion|sion|ment|ance|ence|ism|ology|itis))\b/i, // Scientific/technical suffixes
  ];

  for (const regex of candidates) {
    const match = sentence.match(regex);
    if (match && match[1]) {
      const keyword = match[1].trim();
      const skip = new Set([
        "The", "This", "That", "These", "Those", "There", "When", "What",
        "Which", "Because", "However", "Although", "In", "On", "At", "For", "With"
      ]);
      if (skip.has(keyword) || keyword.length < 3) continue;

      const blanked = sentence.replace(keyword, "__________");
      return { keyword, blanked };
    }
  }

  return null;
}

/**
 * AI Heuristic Active-Recall Parser:
 * Transforms unstructured notes, articles, or summaries into high-yield flashcards.
 */
export function extractFlashcardsFromText(text: string): Flashcard[] {
  const clean = text.trim();
  if (!clean) return [];

  const cards: Flashcard[] = [];
  const seenQuestions = new Set<string>();

  const addCard = (question: string, answer: string, category = "General") => {
    const qClean = question.trim();
    const aClean = cleanAnswer(answer);

    if (qClean.length < 5 || aClean.length < 10) return;
    const normQ = qClean.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenQuestions.has(normQ)) return;

    seenQuestions.add(normQ);
    cards.push({
      id: `card-${cards.length + 1}`,
      question: qClean,
      answer: aClean,
      category,
    });
  };

  // Split into lines
  const rawLines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Pass 1: Structured Line-by-Line Patterns
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.length < 4) continue;

    // Pattern 1: Direct Q&A (e.g. "Q: What is X? A: It is Y")
    const qaMatch = line.match(/^(?:Q|Question)\s*[:.]\s*(.+?)\s*(?:A|Answer)\s*[:.]\s*(.+)$/i);
    if (qaMatch) {
      addCard(qaMatch[1], qaMatch[2], "Direct Q&A");
      continue;
    }

    // Pattern 2: Multi-line Question ending with ? followed by Answer line
    if (line.endsWith("?") && i + 1 < rawLines.length && !rawLines[i + 1].endsWith("?")) {
      addCard(line, rawLines[i + 1], "Concept");
      i++;
      continue;
    }

    // Pattern 3: Key-Value Definition: "Term: Definition", "**Term**: Definition", "Term — Definition" or "Term - Definition" (with spaced hyphen)
    // Avoid splitting compound words like "Public-key" or "Open-source"
    const delimMatch = line.match(/^([*#•\d.)\s]*)([*_`]?)([^:\n]{3,50})\2\s*(?::|\s+[—–]\s*|\s+-\s+|\s*=\s*)\s*(.{12,})$/);
    if (delimMatch && !delimMatch[3].toLowerCase().startsWith("http") && !delimMatch[3].toLowerCase().startsWith("note")) {
      const rawTerm = delimMatch[3];
      const rawAns = delimMatch[4];
      addCard(formatTermQuestion(rawTerm), rawAns, "Definition");
      continue;
    }

    // Pattern 4: Heading with immediate paragraph definition
    if (
      (line.startsWith("#") || line.startsWith("**") && line.endsWith("**")) &&
      i + 1 < rawLines.length &&
      rawLines[i + 1].length > 25 &&
      !rawLines[i + 1].startsWith("#")
    ) {
      const term = cleanTerm(line);
      if (term.length >= 3 && term.length <= 45) {
        addCard(formatTermQuestion(term), rawLines[i + 1], "Topic");
        i++;
        continue;
      }
    }
  }

  // Pass 2: Sentence-Level Semantic Extraction (Grammar & Copula Mining)
  const normalizedText = clean
    .replace(/\b(e\.g\.|i\.e\.|vs\.|Dr\.|Mr\.|Ms\.|Prof\.|approx\.)/gi, (m) => m.replace(/\./g, "§"))
    .replace(/\r?\n+/g, " ");

  const sentences = normalizedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/§/g, ".").trim())
    .filter((s) => s.length >= 25);

  for (const s of sentences) {
    if (cards.length >= 40) break;

    // Rule A: Contrast & Comparison ("Unlike X, which..., Y..." or "The difference between X and Y is...")
    const diffMatch = s.match(/the (?:key |main |primary )?difference between\s+([^and]{3,35})\s+and\s+([^is]{3,35})\s+is (?:that\s+)?(.+)/i);
    if (diffMatch) {
      addCard(
        `What is the key difference between ${cleanTerm(diffMatch[1])} and ${cleanTerm(diffMatch[2])}?`,
        diffMatch[3],
        "Comparison"
      );
      continue;
    }

    const unlikeMatch = s.match(/^Unlike\s+([^,]{3,35}),\s+(?:which\s+[^,]{5,60},\s+)?([A-Z][a-zA-Z0-9\s-]{2,35})\s+(?:produces|results in|is|has|uses|differs|requires|operates)\s+(.+)/i);
    if (unlikeMatch) {
      const subjectA = cleanTerm(unlikeMatch[1]);
      const subjectB = cleanTerm(unlikeMatch[2]);
      addCard(`How does ${subjectB} differ from ${subjectA}?`, s, "Comparison");
      continue;
    }

    // Rule B: Purpose & Function ("The primary purpose of X is to Y")
    const purposeMatch = s.match(/the (?:primary|main|key|core|fundamental|essential)\s+(?:purpose|function|goal|objective|role|benefit)\s+of\s+(?:the\s+)?([a-zA-Z0-9\s,'"-]{3,40})\s+is\s+(?:to\s+)?(.+)/i);
    if (purposeMatch) {
      const subject = cleanTerm(purposeMatch[1]);
      addCard(`What is the primary function of ${subject}?`, purposeMatch[2], "Function");
      continue;
    }

    // Rule C: Copula Definitions ("X is defined as...", "X refers to...", "X is a/an [Type] that...")
    const copulaMatch = s.match(/^([A-Z][a-zA-Z0-9\s,'"-]{2,40})\s+(?:is defined as|refers to|means|is known as)\s+(.+)/i);
    if (copulaMatch) {
      const subject = cleanTerm(copulaMatch[1]);
      addCard(formatTermQuestion(subject), copulaMatch[2], "Definition");
      continue;
    }

    // Rule D: Taxonomic Definitions ("Photosynthesis is the process used by plants...")
    const taxonomyMatch = s.match(/^([A-Z][a-zA-Z0-9\s,'"-]{2,40})\s+(?:is|are)\s+(?:a|an|the)\s+(process|method|system|framework|algorithm|technique|protocol|tool|concept|device|organelle|component|metric|mechanism)\s+((?:that|which|by which|used by|used to|designed to|responsible for|for|where|in which)\s+.+)/i);
    if (taxonomyMatch) {
      const subject = cleanTerm(taxonomyMatch[1]);
      addCard(formatTermQuestion(subject), `A ${taxonomyMatch[2]} ${taxonomyMatch[3]}`, "Concept");
      continue;
    }

    // Rule E: Functional Responsibility ("X is responsible for Y")
    const respMatch = s.match(/^([A-Z][a-zA-Z0-9\s,'"-]{2,40})\s+(?:is|are)\s+responsible for\s+(.+)/i);
    if (respMatch) {
      const subject = cleanTerm(respMatch[1]);
      addCard(`What is ${subject} responsible for?`, respMatch[2], "Function");
      continue;
    }

    // Rule F: Mechanism & Operation ("X works by Y", "X operates by Y")
    const mechMatch = s.match(/^([A-Z][a-zA-Z0-9\s,'"-]{2,40})\s+(?:works|functions|operates|achieves this)\s+by\s+(.+)/i);
    if (mechMatch) {
      const subject = cleanTerm(mechMatch[1]);
      addCard(`How does ${subject} work?`, `By ${mechMatch[2]}`, "Mechanism");
      continue;
    }

    // Rule G: Causal Conditions ("X occurs when/because Y")
    const causeMatch = s.match(/^([A-Z][a-zA-Z0-9\s,'"-]{2,40})\s+(?:occurs|happens|triggers)\s+(?:when|because|due to)\s+(.+)/i);
    if (causeMatch) {
      const subject = cleanTerm(causeMatch[1]);
      addCard(`Under what conditions does ${subject} occur?`, causeMatch[2], "Cause & Effect");
      continue;
    }

    // Rule H: Composition ("X consists of / is composed of Y")
    const compMatch = s.match(/^([A-Z][a-zA-Z0-9\s,'"-]{2,40})\s+(?:consists of|is composed of|comprises|is made up of)\s+(.+)/i);
    if (compMatch) {
      const subject = cleanTerm(compMatch[1]);
      addCard(`What does ${subject} consist of?`, compMatch[2], "Composition");
      continue;
    }
  }

  // Pass 3: Active-Recall Cloze (Fill-in-the-Blank)
  if (cards.length < 5 && sentences.length > 0) {
    for (const s of sentences) {
      if (cards.length >= 15) break;
      if (s.length < 35 || s.length > 250) continue;

      const cloze = findClozeTarget(s);
      if (cloze && cloze.keyword.length >= 3) {
        addCard(
          `Fill in the blank: "${cloze.blanked}"`,
          `${cloze.keyword} — ${s}`,
          "Active Recall"
        );
      }
    }
  }

  // Pass 4: Fallback for bulleted facts or dense summaries
  if (cards.length === 0 && rawLines.length > 0) {
    rawLines.slice(0, 12).forEach((line) => {
      if (line.length >= 25) {
        const words = cleanTerm(line).split(/\s+/);
        const topic = words.slice(0, Math.min(4, words.length)).join(" ");
        addCard(
          `What key concept is described regarding ${topic}?`,
          line,
          "Key Concept"
        );
      }
    });
  }

  return cards;
}
