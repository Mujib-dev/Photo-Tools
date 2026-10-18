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
  rateLimited: () => new AppError(429, "Too many requests. Please try again shortly."),
  downloadGone: () => new AppError(410, "The result has expired. Please process the image again."),
};
