import type { AgentMachineContext } from "../agent/context";

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE CONTENT PARTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Text content part.
 */
export interface TextPart {
  type: "text";
  text: string;
}

/**
 * Audio content part (for voice-specific features).
 * Can represent user speech audio or generated audio.
 */
export interface AudioPart {
  type: "audio";
  /** Base64-encoded audio data or URL */
  data: string;
  /** Audio format (e.g., 'audio/wav', 'audio/mp3', 'audio/pcm') */
  mediaType: string;
  /** Optional transcript of the audio */
  transcript?: string;
}

/**
 * Image content part (for multimodal scenarios).
 */
export interface ImagePart {
  type: "image";
  /** Base64-encoded image data or URL */
  data: string;
  /** Image format (e.g., 'image/png', 'image/jpeg') */
  mediaType: string;
}

/**
 * File content part.
 */
export interface FilePart {
  type: "file";
  /** Base64-encoded file data or URL */
  data: string;
  /** File media type */
  mediaType: string;
  /** Optional filename */
  filename?: string;
}

/**
 * Tool call part - represents an assistant's request to call a tool.
 */
export interface ToolCallPart {
  type: "tool-call";
  /** Unique identifier for this tool call */
  toolCallId: string;
  /** Name of the tool to call */
  toolName: string;
  /** Arguments to pass to the tool */
  args: Record<string, unknown>;
}

/**
 * Tool result part - represents the result of a tool call.
 */
export interface ToolResultPart {
  type: "tool-result";
  /** ID of the tool call this result corresponds to */
  toolCallId: string;
  /** Name of the tool that was called */
  toolName: string;
  /** The result returned by the tool */
  result: unknown;
  /** Whether the tool call resulted in an error */
  isError?: boolean;
}

/**
 * Union of all content part types.
 */
export type ContentPart =
  | TextPart
  | AudioPart
  | ImagePart
  | FilePart
  | ToolCallPart
  | ToolResultPart;

/**
 * Message content can be a simple string or an array of content parts.
 */
export type MessageContent = string | ContentPart[];

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * System message - provides instructions/context to the model.
 */
export interface SystemMessage {
  role: "system";
  content: string;
}

/**
 * User message - represents input from the user.
 * Content can include text, audio, images, or files.
 */
export interface UserMessage {
  role: "user";
  content: string | Array<TextPart | AudioPart | ImagePart | FilePart>;
}

/**
 * Assistant message - represents output from the AI.
 * Content can include text and tool calls.
 */
export interface AssistantMessage {
  role: "assistant";
  content: string | Array<TextPart | ToolCallPart>;
}

/**
 * Tool message - represents tool execution results.
 */
export interface ToolMessage {
  role: "tool";
  content: ToolResultPart[];
}

/**
 * Union of all message types.
 */
export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

/**
 * Output produced when the agent reaches its final state.
 * Provides a summary of the conversation.
 */
export interface AgentMachineOutput {
  /** All messages from the conversation */
  messages: AgentMachineContext["messages"];
  /** Total number of turns (user messages) */
  turnCount: number;
}
