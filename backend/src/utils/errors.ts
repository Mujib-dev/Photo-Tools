/** Typed application errors. The `safe` message is what may be shown to users. */
export class AppError extends Error {
  readonly status: number;
  readonly safe: string;

  constructor(status: number, safe: string, detail?: string) {
    super(safe);
    this.name = "AppError";
    this.status = status;
    this.safe = safe;
    if (detail) (this as { detail?: string }).detail = detail;
  }
}

export const Errors = {
  unsupportedFormat: () => new AppError(400, "The image format is not supported."),
  unsupportedVideoFormat: () => new AppError(400, "The video format is not supported."),
  fileTooLarge: (maxMb: number) =>
    new AppError(413, `The file is too large. Maximum size is ${maxMb} MB.`),
  noFile: () => new AppError(400, "No image file was provided."),
  noVideoFile: () => new AppError(400, "No video file was provided."),
  videoUnavailable: () =>
    new AppError(503, "Video compression is unavailable because FFmpeg is not installed on the server."),
  videoTargetUnreachable: () =>
    new AppError(500, "Could not compress the video to the requested target size."),
  videoNoAudio: () => new AppError(400, "This video has no audio track to extract."),
  invalidSettings: (detail?: string) =>
    new AppError(400, "The requested settings are invalid.", detail),
  jobNotFound: () => new AppError(404, "The requested job was not found."),
  notReady: () => new AppError(409, "The result is not ready yet."),
  processingFailed: (detail?: string) =>
    new AppError(500, "Unable to process the image.", detail),
  timeout: () => new AppError(500, "Image processing timed out."),
  exeError: () => new AppError(500, "The processing application returned an error."),
  unauthorized: () => new AppError(401, "Authentication required."),
  forbidden: (detail?: string) => new AppError(403, "Access denied.", detail),
  rateLimited: () => new AppError(429, "Too many requests. Please try again shortly."),
  downloadGone: () => new AppError(410, "The result has expired. Please process the image again."),
  speechUnavailable: () =>
    new AppError(503, "Speech tools are unavailable on this server. They require Windows speech support."),
  speechFailed: (detail?: string) =>
    new AppError(500, "Unable to process speech. Please try again.", detail),
  speechTextRequired: () => new AppError(400, "Enter some text to convert to speech."),
  speechTextTooLong: (max: number) =>
    new AppError(400, `Text is limited to ${max.toLocaleString("en-US")} characters.`),
  speechVoiceUnavailable: () =>
    new AppError(400, "The selected voice is not installed on this computer."),
  speechNoRecognizer: () =>
    new AppError(
      503,
      "No speech recognition language is installed on this computer. Add one in Windows Settings > Time & Language > Speech.",
    ),
  speechFormatUnavailable: () =>
    new AppError(503, "MP3 export needs FFmpeg. Install FFmpeg or choose WAV."),
  speechNoFile: () => new AppError(400, "No audio file was provided."),
  speechUnsupportedFormat: () =>
    new AppError(400, "The audio or video format is not supported."),
  urlDownloadDisabled: () =>
    new AppError(503, "The URL downloader is disabled on this server."),
  invalidUrl: (detail?: string) =>
    new AppError(400, "Enter a valid http(s) URL.", detail),
  urlDownloadUnsupported: () =>
    new AppError(
      400,
      "That link is not a supported media file or HLS playlist. Direct file and .m3u8 links are supported.",
    ),
  urlDownloadPlatformUnsupported: (platform: string) =>
    new AppError(
      400,
      `${platform} links aren't supported. Paste a direct media file or a public .m3u8 (HLS) URL.`,
    ),
  urlDownloadEncrypted: () =>
    new AppError(400, "Encrypted or DRM-protected streams are not supported."),
  urlDownloadTooLarge: (maxMb: number) =>
    new AppError(413, `The source is larger than the ${maxMb} MB limit.`),
  urlDownloadFailed: (detail?: string) =>
    new AppError(400, detail || "Could not download that URL.", detail),
  urlDownloadUnavailable: () =>
    new AppError(503, "Converting downloaded media needs FFmpeg, which is not installed on the server."),
  passwordResetInvalid: () =>
    new AppError(400, "This reset link or code is invalid or has expired. Please request a new one."),
  apiKeyNotFound: () => new AppError(404, "That API key was not found."),
  insufficientCredits: (cost: number, balance: number) =>
    new AppError(
      402,
      `This costs ${cost} credits but you have ${balance}. Ask an administrator to top up your account or change your plan.`,
    ),
  passwordResetTokenRequired: () =>
    new AppError(400, "Enter the reset code or open the reset link from your message."),
  recoveryChannelUnavailable: () =>
    new AppError(503, "That recovery option is not available right now. Please try another one."),
};
