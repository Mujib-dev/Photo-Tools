import type { Metadata } from "next";
import { FlashcardsTool } from "./flashcards-tool";

export const metadata: Metadata = {
  title: "AI Flashcard & Study Quiz Generator — PicTools",
  description:
    "Drop PDF lecture notes or study guides to automatically generate interactive Q&A study flashcards and printable revision sheets 100% in-browser.",
};

export default function FlashcardsPage() {
  return <FlashcardsTool />;
}
