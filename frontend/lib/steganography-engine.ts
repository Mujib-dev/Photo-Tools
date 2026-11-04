/**
 * Invisible Image Steganography Engine (LSB)
 *
 * Encodes secret text or copyright verification signatures into the
 * least significant bits (LSB) of image pixels without any visible distortion.
 */

const DELIMITER = "###END###";

/**
 * Embed secret text inside an image's pixel data
 */
export async function encodeSecretInImage(
  img: HTMLImageElement,
  secretText: string
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D context.");

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const payload = secretText + DELIMITER;
  const encodedBytes = new TextEncoder().encode(payload);
  const binary: string[] = [];

  for (let i = 0; i < encodedBytes.length; i++) {
    const byte = encodedBytes[i];
    const bits = byte.toString(2).padStart(8, "0");
    binary.push(...bits.split(""));
  }

  // Maximum capacity check (3 bits per pixel: R, G, B)
  const maxBits = (data.length / 4) * 3;
  if (binary.length > maxBits) {
    throw new Error(`Message is too long for this image size (Max capacity: ${Math.floor(maxBits / 8)} characters).`);
  }

  let bitIdx = 0;
  for (let i = 0; i < data.length && bitIdx < binary.length; i++) {
    // Skip alpha channel (every 4th byte)
    if (i % 4 === 3) continue;

    // Replace LSB (least significant bit) with secret bit
    const bit = parseInt(binary[bitIdx], 10);
    data[i] = (data[i] & 0xfe) | bit;
    bitIdx++;
  }

  ctx.putImageData(imgData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode steganography image."))),
      "image/png" // Must be PNG (lossless) so compression doesn't overwrite LSBs!
    );
  });
}

/**
 * Decode secret text from an image's pixel data
 */
export async function decodeSecretFromImage(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D context.");

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  let binaryBits = "";
  const decodedBytes: number[] = [];
  const delimiterBytes = new TextEncoder().encode(DELIMITER);

  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3) continue; // Skip alpha

    const lsb = data[i] & 1;
    binaryBits += lsb.toString();

    // Check every 8 bits (1 byte)
    if (binaryBits.length === 8) {
      const byte = parseInt(binaryBits, 2);
      decodedBytes.push(byte);
      binaryBits = "";

      // Check if we hit the delimiter sequence
      if (decodedBytes.length >= delimiterBytes.length) {
        let matched = true;
        for (let j = 0; j < delimiterBytes.length; j++) {
          if (decodedBytes[decodedBytes.length - delimiterBytes.length + j] !== delimiterBytes[j]) {
            matched = false;
            break;
          }
        }
        if (matched) {
          const secretBytes = new Uint8Array(decodedBytes.slice(0, -delimiterBytes.length));
          return new TextDecoder().decode(secretBytes);
        }
      }
    }

    // Safety cutoff after 65,536 bytes
    if (decodedBytes.length > 65536) break;
  }

  throw new Error("No hidden steganography message detected in this image.");
}
