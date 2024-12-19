export function hexToBytes(hex: string) {
  let bytes = [];
  for (let c = 0; c < hex.length; c += 2)
      bytes.push(parseInt(hex.substring(c, c + 2), 16));
  return new Uint8Array(bytes);
}
