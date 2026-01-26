import type { AgentMachineContext } from "../agent/context";

type DataContent = string | Uint8Array | ArrayBuffer | Buffer;

type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue | undefined };
type JSONArray = JSONValue[];
type ProviderOptions = Record<string, JSONObject>;

export interface TextPart {
  type: "text";
  text: string;
  providerOptions?: ProviderOptions;
}

export interface ImagePart {
  type: "image";
  image: DataContent | URL;
  mediaType?: string;
  providerOptions?: ProviderOptions;
}

export interface FilePart {
  type: "file";
  data: DataContent | URL;
  filename?: string;
  mediaType: string;
  providerOptions?: ProviderOptions;
}

export interface ReasoningPart {
  type: "reasoning";
  text: string;
  providerOptions?: ProviderOptions;
}

export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerOptions?: ProviderOptions;
  providerExecuted?: boolean;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: ToolResultOutput;
  providerOptions?: ProviderOptions;
}

export type ToolResultOutput =
  | { type: "text"; value: string; providerOptions?: ProviderOptions }
  | { type: "json"; value: JSONValue; providerOptions?: ProviderOptions }
  | { type: "execution-denied"; reason?: string; providerOptions?: ProviderOptions }
  | { type: "error-text"; value: string; providerOptions?: ProviderOptions }
  | { type: "error-json"; value: JSONValue; providerOptions?: ProviderOptions }
  | { type: "content"; value: ToolResultContentValue[] };

type ToolResultContentValue =
  | { type: "text"; text: string; providerOptions?: ProviderOptions }
  | {
      type: "file-data";
      data: string;
      mediaType: string;
      filename?: string;
      providerOptions?: ProviderOptions;
    }
  | { type: "file-url"; url: string; providerOptions?: ProviderOptions }
  | { type: "file-id"; fileId: string | Record<string, string>; providerOptions?: ProviderOptions }
  | { type: "image-data"; data: string; mediaType: string; providerOptions?: ProviderOptions }
  | { type: "image-url"; url: string; providerOptions?: ProviderOptions }
  | {
      type: "image-file-id";
      fileId: string | Record<string, string>;
      providerOptions?: ProviderOptions;
    }
  | { type: "custom"; providerOptions?: ProviderOptions };

export interface ToolApprovalRequest {
  type: "tool-approval-request";
  approvalId: string;
  toolCallId: string;
}

export interface ToolApprovalResponse {
  type: "tool-approval-response";
  approvalId: string;
  approved: boolean;
  reason?: string;
  providerExecuted?: boolean;
}

export type UserContent = string | Array<TextPart | ImagePart | FilePart>;
export type AssistantContent =
  | string
  | Array<
      TextPart | FilePart | ReasoningPart | ToolCallPart | ToolResultPart | ToolApprovalRequest
    >;
export type ToolContent = Array<ToolResultPart | ToolApprovalResponse>;

export interface SystemMessage {
  role: "system";
  content: string;
  providerOptions?: ProviderOptions;
}

export interface UserMessage {
  role: "user";
  content: UserContent;
  providerOptions?: ProviderOptions;
}

export interface AssistantMessage {
  role: "assistant";
  content: AssistantContent;
  providerOptions?: ProviderOptions;
}

export interface ToolMessage {
  role: "tool";
  content: ToolContent;
  providerOptions?: ProviderOptions;
}

/**
 * Union of all message types in a conversation.
 *
 * Messages form the conversation history that is passed to the LLM provider.
 * The agent automatically manages the message history as the conversation progresses.
 */
export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

/**
 * Output produced when the agent reaches its final state (status === 'done').
 *
 * Provides a summary of the conversation including all messages and turn count.
 * Available via `agent.getSnapshot().output` when the agent is done.
 */
export interface AgentMachineOutput {
  /** All messages from the conversation (system, user, assistant, tool) */
  messages: AgentMachineContext["messages"];
  /** Total number of turns (user messages) in the conversation */
  turnCount: number;
}
