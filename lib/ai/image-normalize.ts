/**
 * Source photographs come straight off a phone camera. Modern iPhone/Android
 * HDR captures ship as a JPEG container holding more than one image: an APP2
 * `MPF` (Multi-Picture Format) index plus a gain-map image appended after the
 * primary image's EOI.
 *
 * The image-edit endpoint rejects those containers outright with
 * `invalid_image_file` ("Invalid image file or mode for image 1"), because its
 * decoder opens the file as a multi-frame image. Removing the MPF index is
 * sufficient and is what this module does; the primary image's pixels, EXIF
 * orientation and ICC profile are all preserved byte-for-byte.
 *
 * Anything that is not a well-formed JPEG is returned untouched, so a decoding
 * surprise here can never be worse than sending the original bytes.
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP2 = 0xe2;
const TEM = 0x01;
const RST_FIRST = 0xd0;
const RST_LAST = 0xd7;

const MPF_SIGNATURE = [0x4d, 0x50, 0x46, 0x00]; // "MPF\0"

export type NormalizedImage = {
  bytes: Uint8Array<ArrayBuffer>;
  /** Machine-readable notes for job diagnostics; empty when nothing changed. */
  changes: string[];
};

function isJpeg(bytes: Uint8Array<ArrayBuffer>) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === SOI && bytes[2] === 0xff;
}

function hasMpfSignature(bytes: Uint8Array<ArrayBuffer>, offset: number) {
  return MPF_SIGNATURE.every((byte, index) => bytes[offset + index] === byte);
}

function isStandaloneMarker(marker: number) {
  return marker === SOI || marker === EOI || marker === TEM || (marker >= RST_FIRST && marker <= RST_LAST);
}

/**
 * Strip the multi-picture index from a phone JPEG and drop any image appended
 * after the primary image. Returns the input unchanged for non-JPEG or
 * malformed input.
 */
export function normalizeSourceImageBytes(input: Uint8Array<ArrayBuffer>): NormalizedImage {
  if (!isJpeg(input)) return { bytes: input, changes: [] };

  const kept: Uint8Array<ArrayBuffer>[] = [input.subarray(0, 2)];
  const changes: string[] = [];
  let cursor = 2;

  while (cursor < input.length - 1) {
    if (input[cursor] !== 0xff) {
      // Not a marker boundary: the container is not shaped as expected.
      return { bytes: input, changes: [] };
    }

    const marker = input[cursor + 1];

    if (isStandaloneMarker(marker)) {
      kept.push(input.subarray(cursor, cursor + 2));
      cursor += 2;
      continue;
    }

    if (cursor + 4 > input.length) return { bytes: input, changes: [] };
    const segmentLength = (input[cursor + 2] << 8) | input[cursor + 3];
    if (segmentLength < 2 || cursor + 2 + segmentLength > input.length) {
      return { bytes: input, changes: [] };
    }

    if (marker === SOS) {
      // Entropy-coded data follows. A raw 0xFF inside it is always byte-stuffed
      // (0xFF 0x00) or a restart marker, so the first EOI we find terminates the
      // primary image; anything after it is an appended sibling image.
      const scanStart = cursor + 2 + segmentLength;
      let end = input.length;
      for (let index = scanStart; index < input.length - 1; index += 1) {
        if (input[index] === 0xff && input[index + 1] === EOI) {
          end = index + 2;
          break;
        }
      }
      kept.push(input.subarray(cursor, end));
      if (end < input.length) {
        changes.push(`dropped_appended_image_bytes:${input.length - end}`);
      }
      cursor = input.length;
      break;
    }

    if (marker === APP2 && hasMpfSignature(input, cursor + 4)) {
      changes.push("dropped_app2_mpf_index");
      cursor += 2 + segmentLength;
      continue;
    }

    kept.push(input.subarray(cursor, cursor + 2 + segmentLength));
    cursor += 2 + segmentLength;
  }

  if (!changes.length) return { bytes: input, changes: [] };

  let total = 0;
  for (const chunk of kept) total += chunk.length;
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of kept) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return { bytes, changes };
}
