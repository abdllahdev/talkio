/**
 * Test Helpers
 *
 * Central export for all test utilities.
 */

// Mock providers
export {
  createCapturingLLMProvider,
  // Capturing providers (expose contexts)
  createCapturingSTTProvider,
  createCapturingTTSProvider,
  createCapturingTurnDetectorProvider,
  createCapturingVADProvider,
  mockLLMProvider,
  // Simple mock providers
  mockSTTProvider,
  mockTTSProvider,
  mockTurnDetectorProvider,
  mockVADProvider,
  type CapturingLLMProvider,
  // Types
  type CapturingSTTProvider,
  type CapturingTTSProvider,
  type CapturingTurnDetectorProvider,
  type CapturingVADProvider,
} from "./mocks";

// Fixtures
export {
  conversationWithSystemMessage,
  // Audio data generators
  createAudioChunk,
  createNoiseChunk,
  createSilenceChunk,
  createSineWaveChunk,
  // Audio formats
  DEFAULT_AUDIO_FORMAT,
  HIGH_QUALITY_AUDIO_FORMAT,
  LOW_QUALITY_AUDIO_FORMAT,
  multiTurnConversation,
  singleAssistantMessage,
  // Message fixtures
  singleUserMessage,
  // Delay helper
  tick,
} from "./fixtures";

// Assertions
export {
  countEvents,
  expectEventExists,
  expectEventNotExists,
  expectEventSequence,
  expectNoInternalEvents,
  expectSnapshotState,
  findEvent,
  findEvents,
} from "./assertions";
