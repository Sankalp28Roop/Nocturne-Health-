import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { PermissionsService } from './permissions';

export interface VoiceEngineCallbacks {
  onListeningStart?: () => void;
  onTranscript?: (text: string) => void;
  onListeningEnd?: () => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onError?: (err: string) => void;
}

export class VoiceEngine {
  private isListening = false;
  private isSpeaking = false;
  private browserSpeechRec: any = null;
  private callbacks: VoiceEngineCallbacks = {};

  constructor(callbacks: VoiceEngineCallbacks) {
    this.callbacks = callbacks;
    this.initBrowserSpeech();
  }

  private initBrowserSpeech() {
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.browserSpeechRec = new SpeechRec();
        this.browserSpeechRec.continuous = false;
        this.browserSpeechRec.interimResults = true;
        this.browserSpeechRec.lang = 'en-US';

        this.browserSpeechRec.onstart = () => {
          this.isListening = true;
          this.callbacks.onListeningStart?.();
        };

        this.browserSpeechRec.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          if (text) {
            this.callbacks.onTranscript?.(text);
          }
        };

        this.browserSpeechRec.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e);
          this.isListening = false;
          if (e.error === 'not-allowed') {
            this.callbacks.onError?.('Microphone access denied. Please allow microphone permissions in browser.');
          } else if (e.error === 'no-speech') {
            // benign
          } else {
            this.callbacks.onError?.(`Speech recognition error: ${e.error}`);
          }
        };

        this.browserSpeechRec.onend = () => {
          this.isListening = false;
          this.callbacks.onListeningEnd?.();
        };
      }
    }
  }

  // Request Mic permission and start listening
  async startListening(): Promise<boolean> {
    try {
      this.stopSpeaking();

      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        const granted = await PermissionsService.requestMicrophonePermission();
        if (!granted) {
          this.callbacks.onError?.('Microphone permission required. Please enable it in Settings.');
          return false;
        }

        const hasCapSpeech = typeof (SpeechRecognition as any)?.start === 'function';
        if (hasCapSpeech) {
          this.isListening = true;
          this.callbacks.onListeningStart?.();

          SpeechRecognition.removeAllListeners().catch(() => {});
          SpeechRecognition.addListener('partialResults', (data: any) => {
            if (data.matches && data.matches.length > 0) {
              this.callbacks.onTranscript?.(data.matches[0]);
            }
          });

          SpeechRecognition.start({
            language: 'en-US',
            maxResults: 2,
            prompt: 'Speak to Nocturne Coach...',
            partialResults: true,
            popup: false
          }).catch((err) => {
            console.warn('Native speech error, fallback to browser:', err);
            this.startBrowserListening();
          });

          return true;
        }
      }

      // Web Browser fallback
      return this.startBrowserListening();
    } catch (err: any) {
      console.warn('Speech start error:', err);
      return this.startBrowserListening();
    }
  }

  private startBrowserListening(): boolean {
    if (this.browserSpeechRec) {
      try {
        this.browserSpeechRec.start();
        return true;
      } catch (e: any) {
        if (e.name === 'InvalidStateError') {
          // Already listening
          return true;
        }
        console.warn('Browser speech start error:', e);
      }
    } else {
      // Check if blocked by non-secure context
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        this.callbacks.onError?.('Speech recognition on non-localhost IP requires HTTPS. You can still use text chat or use the installed Android app!');
      } else {
        this.callbacks.onError?.('Speech recognition not supported in this browser. Please use Chrome/Edge or the Android app.');
      }
    }
    return false;
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    try {
      if (typeof (SpeechRecognition as any)?.stop === 'function') {
        await SpeechRecognition.stop();
      }
    } catch {}
    try {
      this.browserSpeechRec?.stop();
    } catch {}
    this.callbacks.onListeningEnd?.();
  }

  // Speak AI reply aloud using Text-to-Speech
  async speak(text: string): Promise<void> {
    if (!text.trim()) return;

    this.stopListening();
    this.isSpeaking = true;
    this.callbacks.onSpeakingStart?.();

    // Clean text for speech
    const cleanText = text
      .replace(/[*#`_~[\]]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    try {
      if (Capacitor.isNativePlatform()) {
        const hasCapTts = typeof (TextToSpeech as any)?.speak === 'function';
        if (hasCapTts) {
          await TextToSpeech.speak({
            text: cleanText,
            lang: 'en-US',
            rate: 1.05,
            pitch: 1.0,
            volume: 1.0,
            category: 'ambient'
          });
          this.isSpeaking = false;
          this.callbacks.onSpeakingEnd?.();
          return;
        }
      }
    } catch (err) {
      console.warn('Native TTS error, fallback to browser:', err);
    }

    // Web Speech Synthesis Fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onend = () => {
        this.isSpeaking = false;
        this.callbacks.onSpeakingEnd?.();
      };

      utterance.onerror = (e) => {
        console.warn('Utterance error:', e);
        this.isSpeaking = false;
        this.callbacks.onSpeakingEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      this.isSpeaking = false;
      this.callbacks.onSpeakingEnd?.();
    }
  }

  // Interrupt playback (barge-in)
  stopSpeaking(): void {
    this.isSpeaking = false;
    try {
      if (typeof (TextToSpeech as any)?.stop === 'function') {
        TextToSpeech.stop().catch(() => {});
      }
    } catch {}
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  destroy(): void {
    this.stopListening();
    this.stopSpeaking();
  }
}
