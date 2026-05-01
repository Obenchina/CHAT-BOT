import { useRef, useState } from 'react';
import aiChatService from '../services/aiChatService';
import { showError } from '../utils/toast';

export default function useVoiceTranscription({ onText, lang } = {}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const stop = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      setRecording(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }
  };

  const start = async () => {
    if (recording || transcribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setRecording(false);
        setTranscribing(true);

        try {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          const res = await aiChatService.transcribe(blob, lang);
          const text = String(res?.data?.text || res?.data?.data?.text || '').trim();

          if (res?.success && text) {
            onText?.(text);
          } else if (!res?.success) {
            showError(res?.message || 'Échec de la transcription audio');
          }
        } catch (error) {
          console.error('Voice transcription error:', error);
          showError(error?.message || 'Échec de la transcription audio');
        } finally {
          setTranscribing(false);
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          recorderRef.current = null;
          chunksRef.current = [];
        }
      };

      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Microphone error:', error);
      showError('Microphone non disponible. Vérifiez les permissions.');
    }
  };

  const toggle = () => {
    if (recording) {
      stop();
    } else {
      start();
    }
  };

  return {
    recording,
    transcribing,
    start,
    stop,
    toggle,
  };
}
