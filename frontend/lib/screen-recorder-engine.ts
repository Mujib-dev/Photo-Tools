/**
 * Studio Screen & Webcam Recorder with Audio Mixer
 *
 * Captures screen (getDisplayMedia) and optional webcam PiP (getUserMedia),
 * combines them onto a 60FPS composite canvas, mixes system & mic audio,
 * and records with client-side MediaRecorder.
 */

export interface RecorderOptions {
  recordScreen: boolean;
  recordWebcam: boolean;
  recordMic: boolean;
  webcamPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  webcamShape: "circle" | "rounded-rect";
  webcamSizePercent: number; // e.g. 20%
}

export interface TeleprompterConfig {
  script: string;
  speed: number; // 1 (slow) to 10 (fast)
  fontSize: number; // in px
  mirrorMode: boolean; // flip horizontally for beam splitter glass
  isPlaying: boolean;
}

export const DEFAULT_TELEPROMPTER: TeleprompterConfig = {
  script: `Welcome to this tutorial! In today's video, I'll walk you through how to use PicTools to edit, convert, and enhance your media in seconds.

First, let's take a look at the navigation bar on the left...`,
  speed: 3,
  fontSize: 24,
  mirrorMode: false,
  isPlaying: false,
};

/**
 * Checks if screen capture is supported
 */
export function isScreenCaptureSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/**
 * Checks if webcam capture is supported
 */
export function isWebcamSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}
