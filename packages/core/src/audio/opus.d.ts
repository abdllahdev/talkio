/**
 * Type declarations for optional @discordjs/opus dependency.
 * This module is dynamically imported and may not be available.
 */
declare module "@discordjs/opus" {
  export class OpusEncoder {
    constructor(sampleRate: number, channels: number);
    encode(buffer: Buffer): Buffer;
    decode(buffer: Buffer): Buffer;
  }
}
