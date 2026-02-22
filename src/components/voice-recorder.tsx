"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
