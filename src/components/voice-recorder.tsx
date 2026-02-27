"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  onAudioRecorded?: (blob: Blob) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onTranscription, onAudioRecorded, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Request microphone access for MediaRecorder
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Fallback: speech recognition only, no audio capture
      stream = null as unknown as MediaStream;
    }

    // Start MediaRecorder if stream available
    if (stream) {
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 0 && onAudioRecorded) {
          onAudioRecorded(audioBlob);
        }
        // Release microphone
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    }

    // Start Speech Recognition
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;

    finalTranscriptRef.current = "";
    setInterim("");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      finalTranscriptRef.current = finalText;
      setInterim(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setRecording(false);
      // Stop MediaRecorder on error
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };

    recognition.onend = () => {
      setRecording(false);
      const transcript = finalTranscriptRef.current.trim();
      if (transcript) {
        onTranscription(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [onTranscription, onAudioRecorded]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        La reconnaissance vocale n&apos;est pas supportée par ce navigateur. Utilisez Chrome ou Edge.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={recording ? "destructive" : "default"}
        className="w-full"
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled}
      >
        {recording ? "Arrêter l'enregistrement" : "Enregistrer"}
      </Button>
      {recording && interim && (
        <p className="text-xs text-muted-foreground italic">{interim}</p>
      )}
    </div>
  );
}
