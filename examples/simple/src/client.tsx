import { useState, useRef, useCallback, useEffect } from "react";

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

type LogEntry = {
  id: number;
  message: string;
  type: "system" | "human" | "ai";
};

type ConnectionStatus = "disconnected" | "connected" | "error";

function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = float32Array[i] ?? 0;
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function int16ToFloat32(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer);
  const float32 = new Float32Array(buffer.byteLength / 2);
  for (let i = 0; i < float32.length; i++) {
    float32[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return float32;
}

export function VoiceAgentDemo() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [statusText, setStatusText] = useState("Disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "system") => {
    setLogs((prev) => [...prev, { id: logIdRef.current++, message, type }]);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const playAudio = useCallback(async (buffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    const float32 = int16ToFloat32(buffer);
    const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStatus("disconnected");
    setStatusText("Disconnected");
  }, []);

  const start = useCallback(async () => {
    try {
      audioContextRef.current = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const ws = new WebSocket(`ws://${window.location.host}/ws`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setStatusText("Connected - Speak now!");
        addLog("Connected to server");
        setIsRunning(true);

        const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
        const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const float32 = e.inputBuffer.getChannelData(0);
            const pcm16 = floatTo16BitPCM(float32);
            ws.send(pcm16);
          }
        };

        source.connect(processor);
        processor.connect(audioContextRef.current!.destination);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          playAudio(event.data);
        } else {
          const msg = JSON.parse(event.data);
          if (msg.type === "transcript") {
            addLog(`[You] ${msg.text}`, "human");
          } else if (msg.type === "response") {
            addLog(`[Agent] ${msg.text}`, "ai");
          } else if (msg.type === "status") {
            addLog(msg.text, "system");
          }
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        setStatusText("Disconnected");
        addLog("Disconnected");
        stop();
      };

      ws.onerror = () => {
        setStatus("error");
        setStatusText("Connection error");
        addLog("WebSocket error");
        stop();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setStatusText(`Error: ${message}`);
      addLog(`Error: ${message}`);
    }
  }, [addLog, playAudio, stop]);

  return (
    <div className="container">
      <h1>Voice Agent Demo</h1>
      <div className={`status ${status}`}>{statusText}</div>
      <button className="start-btn" onClick={start} disabled={isRunning}>
        Start Conversation
      </button>
      <button className="stop-btn" onClick={stop} disabled={!isRunning}>
        Stop
      </button>
      <div className="log" ref={logContainerRef}>
        {logs.map((log) => (
          <div key={log.id} className={`log-entry log-${log.type}`}>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
