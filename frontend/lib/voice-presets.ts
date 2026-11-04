import type { VoicePreset } from "./types";

export interface VoiceCharacter {
  id: VoicePreset;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  transformation: string;
  pitchShift: number; // Semitones (-12 to +12)
  speed: number; // 0.5x to 2.0x
  reverb: number; // 0 to 1
  badge: string;
}

export const VOICE_CHARACTERS: VoiceCharacter[] = [
  {
    id: "none",
    name: "Original Voice",
    emoji: "🎙️",
    tagline: "Natural unaltered voice",
    description: "Keeps the original vocal pitch, timbre and tempo without any voice changing.",
    transformation: "Natural",
    pitchShift: 0,
    speed: 1.0,
    reverb: 0,
    badge: "Default",
  },
  {
    id: "girl",
    name: "Girl / Woman",
    emoji: "👧",
    tagline: "Man to feminine voice",
    description:
      "Shifts vocal tract formants higher and raises pitch by +4.2 semitones to authentically transform a male voice into a natural female tone.",
    transformation: "Man → Girl",
    pitchShift: 4.2,
    speed: 1.0,
    reverb: 0.1,
    badge: "Popular",
  },
  {
    id: "man",
    name: "Deep Man / Baritone",
    emoji: "👨",
    tagline: "Woman or teen to deep male",
    description:
      "Lowers pitch by -3.8 semitones and deepens chest resonance to give voices an authoritative, deep masculine radio timbre.",
    transformation: "Girl → Deep Man",
    pitchShift: -3.8,
    speed: 1.0,
    reverb: 0.05,
    badge: "Deep Voice",
  },
  {
    id: "baby",
    name: "Baby / Kid",
    emoji: "👶",
    tagline: "Cute high-pitched child voice",
    description:
      "Lifts pitch into high toddler frequencies (+6.8 semitones) with lively cadence for an adorable, playful child sound.",
    transformation: "Adult → Baby",
    pitchShift: 6.8,
    speed: 1.05,
    reverb: 0.05,
    badge: "Fun & Cute",
  },
  {
    id: "chipmunk",
    name: "Chipmunk / Cartoon",
    emoji: "🐿️",
    tagline: "Fast animated comedy squeak",
    description:
      "Classic cartoon style with ultra-high pitch (+9.0 semitones) and brisk tempo for funny sketches and memes.",
    transformation: "Any → Chipmunk",
    pitchShift: 9.0,
    speed: 1.15,
    reverb: 0,
    badge: "Comedy",
  },
  {
    id: "monster",
    name: "Monster / Giant",
    emoji: "👹",
    tagline: "Subterranean villain growl",
    description:
      "Deep subterranean pitch drop (-6.5 semitones) with heavy 100Hz sub-bass boost to produce an imposing villain or monster roar.",
    transformation: "Any → Monster",
    pitchShift: -6.5,
    speed: 0.92,
    reverb: 0.25,
    badge: "Sci-Fi",
  },
  {
    id: "robot",
    name: "Robot / Cyborg",
    emoji: "🤖",
    tagline: "Metallic vocoder synthesizer",
    description:
      "Applies cybernetic sinusoidal flanging, frequency quantization and metallic pitch for an authentic AI android voice.",
    transformation: "Human → Cyborg",
    pitchShift: -1.2,
    speed: 1.0,
    reverb: 0.15,
    badge: "Futuristic",
  },
  {
    id: "helium",
    name: "Helium Balloon",
    emoji: "🎈",
    tagline: "Squeaky gas inhalation effect",
    description:
      "Recreates the unmistakable squeak of inhaling party balloon helium with crisp harmonic articulation.",
    transformation: "Any → Helium",
    pitchShift: 8.2,
    speed: 1.0,
    reverb: 0,
    badge: "Party",
  },
  {
    id: "radio",
    name: "Walkie-Talkie Radio",
    emoji: "📻",
    tagline: "Vintage telecom & CB radio",
    description:
      "Tight 400Hz–3400Hz telephone bandpass frequency envelope replicating emergency walkie-talkies and pilot dispatchers.",
    transformation: "Studio → Telecom",
    pitchShift: 0,
    speed: 1.0,
    reverb: 0,
    badge: "Retro",
  },
  {
    id: "echo",
    name: "Cathedral / Space Echo",
    emoji: "🌌",
    tagline: "Spacious multi-tap reverb",
    description:
      "Envelops the voice in expansive cathedral reflections and atmospheric 500ms multi-tap stereo echo.",
    transformation: "Dry → Cathedral",
    pitchShift: 0,
    speed: 1.0,
    reverb: 0.75,
    badge: "Ambient",
  },
  {
    id: "studio",
    name: "Studio Vocal Polisher",
    emoji: "🎙️",
    tagline: "Broadcast clarity & presence",
    description:
      "Gentle low-end mud cut (-2dB @ 250Hz) and high-mid air boost (+3dB @ 3.5kHz) for radio and podcast vocal polish.",
    transformation: "Raw → Mastered",
    pitchShift: 0,
    speed: 1.0,
    reverb: 0.08,
    badge: "Pro",
  },
];

export function getVoiceCharacter(id: VoicePreset): VoiceCharacter {
  return VOICE_CHARACTERS.find((c) => c.id === id) ?? VOICE_CHARACTERS[0];
}
