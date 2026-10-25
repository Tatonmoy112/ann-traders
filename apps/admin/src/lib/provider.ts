export function validatePdf(bytes: Uint8Array) {
  if (
    bytes.length < 8 ||
    bytes.length > 10485760 ||
    new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-'
  )
    throw new Error('Upload a valid PDF of at most 10 MB');
}
export function imageMime(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'image/png';
  const text = new TextDecoder();
  if (text.decode(bytes.slice(0, 4)) === 'RIFF' && text.decode(bytes.slice(8, 12)) === 'WEBP')
    return 'image/webp';
  throw new Error('Unsupported image content');
}
