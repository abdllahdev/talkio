/**
 * Unit Tests: Audio Conversions
 *
 * Tests for audio format conversion utilities.
 */

import { describe, expect, it } from "vitest";

import {
  float32ToInt16,
  int16ToFloat32,
  linear16ToFloat32,
  float32ToLinear16,
  stereoToMono,
  resample,
  resampleInt16,
  mulawToLinear16,
  alawToLinear16,
} from "../../../src/audio/conversions";

describe("audio conversions", () => {
  describe("float32ToInt16", () => {
    it("converts zero correctly", () => {
      const input = new Float32Array([0.0]);
      const output = float32ToInt16(input);
      expect(output[0]).toBe(0);
    });

    it("converts positive values correctly", () => {
      const input = new Float32Array([0.5, 1.0]);
      const output = float32ToInt16(input);
      expect(output[0]).toBeCloseTo(16383, -1); // 0.5 * 0x7fff
      expect(output[1]).toBe(32767); // 1.0 * 0x7fff
    });

    it("converts negative values correctly", () => {
      const input = new Float32Array([-0.5, -1.0]);
      const output = float32ToInt16(input);
      expect(output[0]).toBeCloseTo(-16384, -1); // -0.5 * 0x8000
      expect(output[1]).toBe(-32768); // -1.0 * 0x8000
    });

    it("clamps values outside [-1, 1] range", () => {
      const input = new Float32Array([2.0, -2.0]);
      const output = float32ToInt16(input);
      expect(output[0]).toBe(32767); // Clamped to 1.0
      expect(output[1]).toBe(-32768); // Clamped to -1.0
    });
  });

  describe("int16ToFloat32", () => {
    it("converts zero correctly", () => {
      const input = new Int16Array([0]);
      const output = int16ToFloat32(input);
      expect(output[0]).toBe(0.0);
    });

    it("converts positive values correctly", () => {
      const input = new Int16Array([16384, 32767]);
      const output = int16ToFloat32(input);
      expect(output[0]).toBeCloseTo(0.5, 1);
      expect(output[1]).toBeCloseTo(1.0, 1);
    });

    it("converts negative values correctly", () => {
      const input = new Int16Array([-16384, -32768]);
      const output = int16ToFloat32(input);
      expect(output[0]).toBeCloseTo(-0.5, 1);
      expect(output[1]).toBe(-1.0);
    });
  });

  describe("float32ToLinear16 and linear16ToFloat32", () => {
    it("round-trips correctly", () => {
      const original = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0]);
      const linear16 = float32ToLinear16(original);
      const backToFloat32 = linear16ToFloat32(linear16);

      for (let i = 0; i < original.length; i++) {
        expect(backToFloat32[i]).toBeCloseTo(original[i], 1);
      }
    });
  });

  describe("stereoToMono", () => {
    it("averages left and right channels", () => {
      // Stereo: [L0, R0, L1, R1]
      const stereo = new Float32Array([0.5, 0.3, 0.7, 0.1]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(2);
      expect(mono[0]).toBeCloseTo(0.4, 5); // (0.5 + 0.3) / 2
      expect(mono[1]).toBeCloseTo(0.4, 5); // (0.7 + 0.1) / 2
    });

    it("works with Int16Array", () => {
      const stereo = new Int16Array([1000, 500, 2000, 1000]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(2);
      expect(mono[0]).toBe(750); // (1000 + 500) / 2
      expect(mono[1]).toBe(1500); // (2000 + 1000) / 2
    });
  });

  describe("resample", () => {
    it("returns same data if sample rates are equal", () => {
      const input = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const output = resample(input, 16000, 16000);

      expect(output).toBe(input); // Same reference
    });

    it("downsamples 48kHz to 16kHz", () => {
      // Create 48 samples at 48kHz = 1ms of audio
      const input = new Float32Array(48);
      for (let i = 0; i < 48; i++) {
        input[i] = Math.sin((2 * Math.PI * i) / 48);
      }

      const output = resample(input, 48000, 16000);

      // Should have 16 samples at 16kHz = 1ms of audio
      expect(output.length).toBe(16);
    });

    it("upsamples 8kHz to 16kHz", () => {
      const input = new Float32Array([0.0, 0.5, 1.0, 0.5, 0.0]);
      const output = resample(input, 8000, 16000);

      // Should double the sample count
      expect(output.length).toBe(10);
    });
  });

  describe("resampleInt16", () => {
    it("returns same data if sample rates are equal", () => {
      const input = new Int16Array([100, 200, 300, 400]);
      const output = resampleInt16(input, 16000, 16000);

      expect(output).toBe(input); // Same reference
    });

    it("downsamples correctly", () => {
      // Create 48 samples
      const input = new Int16Array(48);
      for (let i = 0; i < 48; i++) {
        input[i] = Math.round(Math.sin((2 * Math.PI * i) / 48) * 32767);
      }

      const output = resampleInt16(input, 48000, 16000);

      // Should have 16 samples
      expect(output.length).toBe(16);
    });
  });

  describe("mulawToLinear16", () => {
    it("decodes silence correctly", () => {
      // Mu-law silence is typically 0xff or 0x7f
      const mulaw = new Uint8Array([0xff]);
      const linear = mulawToLinear16(mulaw);

      // Should be close to zero
      expect(Math.abs(linear[0])).toBeLessThan(100);
    });

    it("decodes known values", () => {
      // Test with a few known mu-law values
      const mulaw = new Uint8Array([0x00, 0x80]);
      const linear = mulawToLinear16(mulaw);

      // These should produce different values (opposite signs or magnitudes)
      expect(linear[0]).not.toBe(linear[1]);
    });
  });

  describe("alawToLinear16", () => {
    it("decodes silence correctly", () => {
      // A-law silence is typically 0xd5
      const alaw = new Uint8Array([0xd5]);
      const linear = alawToLinear16(alaw);

      // Should be close to zero
      expect(Math.abs(linear[0])).toBeLessThan(100);
    });

    it("decodes known values", () => {
      const alaw = new Uint8Array([0x00, 0x80]);
      const linear = alawToLinear16(alaw);

      // These should produce different values
      expect(linear[0]).not.toBe(linear[1]);
    });
  });
});
