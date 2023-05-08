import { script } from 'bitcoinjs-lib';
import type { IntegerType } from 'micro-stacks/common';
import { intToHexString, hexToBytes, utf8ToBytes } from 'micro-stacks/common';
import { hashSha256 } from 'micro-stacks/crypto-sha';
export type { HTLC } from 'magic-protocol';
import type { HTLC } from 'magic-protocol';
import { createHtlcScript, encodeHtlcOutput } from 'magic-protocol';
import { getOutboundAddress } from './utils';

export type BufferType = Buffer | Uint8Array;

export function numberToLE(num: IntegerType, length = 4) {
  const hexBE = intToHexString(num, length);
  let le = '';
  // reverse the buffer
  for (let i = 0; i < length; i++) {
    le += hexBE.slice(-2 * (i + 1), -2 * i || length * 2);
  }
  return le;
}

export function numberToLEBytes(num: IntegerType, length = 4) {
  return hexToBytes(numberToLE(num, length));
}

export const CSV_DELAY = 500;
export const CSV_DELAY_BUFF = script.number.encode(CSV_DELAY);
export const CSV_DELAY_HEX = CSV_DELAY_BUFF.toString('hex');

export function generateHTLCScript(htlc: HTLC) {
  return createHtlcScript(htlc);
}

export function generateHTLCAddress(htlc: HTLC) {
  const script = generateHTLCScript(htlc);
  const output = encodeHtlcOutput(script);
  return getOutboundAddress(output);
}

export function reverseBuffer(buffer: BufferType): Uint8Array {
  if (buffer.length < 1) return buffer;
  let j = buffer.length - 1;
  let tmp = 0;
  for (let i = 0; i < buffer.length / 2; i++) {
    tmp = buffer[i];
    buffer[i] = buffer[j];
    buffer[j] = tmp;
    j--;
  }
  return Uint8Array.from(buffer);
}

export function getScriptHash(output: BufferType): Uint8Array {
  const uintOutput = Uint8Array.from(output);
  const hash = hashSha256(uintOutput);
  const reversed = reverseBuffer(Buffer.from(hash));
  return reversed;
}

export function hexPadded(hex: string) {
  const bytes = hex.length % 2 ? `0${hex}` : hex;
  return bytes;
}

export function secretToHash(secret: string) {
  const bytes = utf8ToBytes(secret);
  return hashSha256(bytes);
}
