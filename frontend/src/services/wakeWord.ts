import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Motion } from '@capacitor/motion';
import { Preferences } from '@capacitor/preferences';
import { PermissionsService } from './permissions';
import { useMusicStore } from '../store/musicStore';
import { useModalStore } from '../store/modalStore';

export type WakeWordListenerCallback = (triggeredPhrase: string, remainingText?: string) => void;

class WakeWordService {
  private static readonly PREF_KEY = 'nocturne_hey_friday_enabled';
  private isEnabled = false;
  private isListening = false;
  private onTriggerCallback: WakeWordListenerCallback | null = null;
  private statusListeners: Array<(active: boolean) => void> = [];

  // Web Audio VAD (Voice Activity Detection) state
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyserNode: AnalyserNode | null = null;
  private vadIntervalId: any = null;
  private speechSustainedCount = 0;

  // Single-flight mutex and cooldown guards
  private isRecognizing = false;
  private lastRecognitionEndTime = 0;

  // Shake-to-talk listener handle
  private motionListenerHandle: any = null;
  private lastShakeTime = 0;

  constructor() {
    this.isEnabled = localStorage.getItem(WakeWordService.PREF_KEY) === 'true';
    Preferences.get({ key: WakeWordService.PREF_KEY }).then(({ value }) => {
      if (value !== null) {
        this.isEnabled = value === 'true';
      }
    }).catch(() => {});

    // Hard-pause VAD mic immediately whenever music is playing
    useMusicStore.subscribe((state) => {
      if (state.isPlaying) {
        // Stop audio capture immediately while music plays through speakers
        this.stopVadMonitoring();
      } else if (this.isEnabled && this.isListening && !this.isModalActive()) {
        // Resume silent VAD monitoring after music stops
        setTimeout(() => {
          if (!useMusicStore.getState().isPlaying && this.isEnabled && this.isListening) {
            this.startVadMonitoring();
          }
        }, 300);
      }
    });

    // Pause VAD mic if voice modal/drawer is open
    useModalStore.subscribe(() => {
      if (this.isModalActive()) {
        this.stopVadMonitoring();
      } else if (this.isEnabled && this.isListening && !useMusicStore.getState().isPlaying) {
        setTimeout(() => {
          if (!this.isModalActive() && !useMusicStore.getState().isPlaying && this.isEnabled && this.isListening) {
            this.startVadMonitoring();
          }
        }, 400);
      }
    });
  }

  private isModalActive(): boolean {
    const modalState = useModalStore.getState();
    const musicState = useMusicStore.getState();
    return modalState.isLiveVoiceOpen || modalState.isAiCoachOpen || musicState.isSaySongModalOpen;
  }

  public isWakeWordEnabled(): boolean {
    return this.isEnabled;
  }

  public isWakeWordListening(): boolean {
    const musicPlaying = useMusicStore.getState().isPlaying;
    return this.isListening && !musicPlaying && !this.isModalActive();
  }

  public addStatusListener(cb: (active: boolean) => void) {
    this.statusListeners.push(cb);
    cb(this.isWakeWordListening());
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== cb);
    };
  }

  private notifyStatus() {
    const active = this.isWakeWordListening();
    this.statusListeners.forEach(cb => cb(active));
  }

  public async setEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
    this.isEnabled = enabled;
    localStorage.setItem(WakeWordService.PREF_KEY, String(enabled));
    await Preferences.set({ key: WakeWordService.PREF_KEY, value: String(enabled) }).catch(() => {});

    if (enabled) {
      const hasMic = await PermissionsService.requestMicrophonePermission();
      if (!hasMic) {
        this.isEnabled = false;
        localStorage.setItem(WakeWordService.PREF_KEY, 'false');
        await Preferences.set({ key: WakeWordService.PREF_KEY, value: 'false' }).catch(() => {});
        this.notifyStatus();
        return {
          success: false,
          message: 'Microphone permission is required for hands-free mode.'
        };
      }

      await this.startListening();
      return {
        success: true,
        message: "Hands-Free 'Hey Friday' enabled — say 'Hey Friday' or shake your phone to talk."
      };
    } else {
      this.stopListening();
      return {
        success: true,
        message: "Hands-Free 'Hey Friday' disabled."
      };
    }
  }

  public registerTriggerCallback(cb: WakeWordListenerCallback) {
    this.onTriggerCallback = cb;
  }

  public async startListening() {
    if (!this.isEnabled) return;
    this.isListening = true;
    this.notifyStatus();

    // 1) Start Shake-to-Talk sensor (always active in foreground when enabled, even while music plays)
    this.startShakeDetection();

    // 2) Start silent VAD only if music is not currently playing
    if (!useMusicStore.getState().isPlaying && !this.isModalActive()) {
      this.startVadMonitoring();
    }
  }

  public stopListening() {
    this.isListening = false;
    this.stopVadMonitoring();
    this.stopShakeDetection();
    this.notifyStatus();
  }

  // ==========================================
  // 1. Shake-to-Talk Sensor
  // ==========================================
  private async startShakeDetection() {
    if (!Capacitor.isPluginAvailable('Motion')) return;

    try {
      this.stopShakeDetection();
      let lastX = 0, lastY = 0, lastZ = 0;

      this.motionListenerHandle = await Motion.addListener('accel', async (event) => {
        if (!this.isEnabled || !this.isListening) return;

        const current = event.acceleration;
        if (!current) return;

        const deltaX = Math.abs(current.x - lastX);
        const deltaY = Math.abs(current.y - lastY);
        const deltaZ = Math.abs(current.z - lastZ);

        lastX = current.x;
        lastY = current.y;
        lastZ = current.z;

        const speed = deltaX + deltaY + deltaZ;
        const now = Date.now();

        if (speed > 28 && now - this.lastShakeTime > 2000) {
          this.lastShakeTime = now;
          PermissionsService.hapticTap();
          this.playChime();

          // Auto-duck / pause music before listening
          const music = useMusicStore.getState();
          const wasPlaying = music.isPlaying;
          if (wasPlaying) {
            music.pause();
          }

          // Let speaker audio settle for 200ms
          await new Promise(r => setTimeout(r, 200));

          this.onTriggerCallback?.('shake');
        }
      });
    } catch (e) {
      console.warn('[WakeWord] Shake listener error:', e);
    }
  }

  private stopShakeDetection() {
    if (this.motionListenerHandle) {
      try {
        this.motionListenerHandle.remove();
      } catch {}
      this.motionListenerHandle = null;
    }
  }

  // ==========================================
  // 2. VAD-Gated Silent Wake-Word Engine
  // ==========================================
  private async startVadMonitoring() {
    // If music is playing or modal active, stay completely detached
    if (useMusicStore.getState().isPlaying || this.isModalActive()) {
      return;
    }

    try {
      if (this.mediaStream) {
        return; // Already attached
      }

      if (!navigator.mediaDevices?.getUserMedia) return;

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      source.connect(this.analyserNode);

      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.vadIntervalId = setInterval(() => {
        // Strictly stop if music started or modal opened
        if (!this.isEnabled || !this.isListening || useMusicStore.getState().isPlaying || this.isModalActive() || this.isRecognizing) {
          this.speechSustainedCount = 0;
          return;
        }

        // Strict 2-second cooldown after any recognition ends
        const now = Date.now();
        if (now - this.lastRecognitionEndTime < 2000) {
          return;
        }

        this.analyserNode?.getByteFrequencyData(dataArray);

        let sum = 0;
        let count = 0;
        for (let i = 2; i < Math.min(24, bufferLength); i++) {
          sum += dataArray[i];
          count++;
        }
        const avgEnergy = count > 0 ? sum / count : 0;

        // Requires clear conversational voice energy
        if (avgEnergy > 46) {
          this.speechSustainedCount++;
          // Sustained for ~240ms (3 checks)
          if (this.speechSustainedCount >= 3) {
            this.speechSustainedCount = 0;
            this.triggerSingleRecognitionPass();
          }
        } else {
          this.speechSustainedCount = Math.max(0, this.speechSustainedCount - 1);
        }
      }, 80);
    } catch (e) {
      console.warn('[WakeWord] VAD initialization skipped:', e);
    }
  }

  private stopVadMonitoring() {
    if (this.vadIntervalId) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.speechSustainedCount = 0;
  }

  /**
   * Runs a SINGLE isolated speech recognition pass guarded by single-flight mutex.
   */
  private async triggerSingleRecognitionPass() {
    if (this.isRecognizing || useMusicStore.getState().isPlaying || this.isModalActive()) {
      return;
    }
    this.isRecognizing = true;

    // Temporarily pause VAD audio track while SpeechRecognizer opens
    this.stopVadMonitoring();

    try {
      if (Capacitor.isNativePlatform()) {
        await this.runNativeSinglePass();
      } else {
        await this.runBrowserSinglePass();
      }
    } catch (e) {
      console.warn('[WakeWord] Recognition pass error:', e);
    } finally {
      this.isRecognizing = false;
      this.lastRecognitionEndTime = Date.now();

      // Only restart silent VAD if music is still not playing and no modal opened
      if (this.isEnabled && this.isListening && !useMusicStore.getState().isPlaying && !this.isModalActive()) {
        setTimeout(() => {
          if (this.isEnabled && this.isListening && !useMusicStore.getState().isPlaying && !this.isModalActive()) {
            this.startVadMonitoring();
          }
        }, 2000);
      }
    }
  }

  private runBrowserSinglePass(): Promise<void> {
    return new Promise((resolve) => {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        resolve();
        return;
      }

      try {
        const recognizer = new SpeechRec();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.lang = 'en-US';

        const timer = setTimeout(() => {
          try { recognizer.abort(); } catch {}
          resolve();
        }, 2500);

        recognizer.onresult = (event: any) => {
          clearTimeout(timer);
          const transcript = event.results[0]?.[0]?.transcript || '';
          this.checkPhrase(transcript.toLowerCase());
          resolve();
        };

        recognizer.onerror = () => {
          clearTimeout(timer);
          resolve();
        };

        recognizer.onend = () => {
          clearTimeout(timer);
          resolve();
        };

        recognizer.start();
      } catch {
        resolve();
      }
    });
  }

  private runNativeSinglePass(): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        SpeechRecognition.removeAllListeners().catch(() => {});

        let finished = false;
        const done = () => {
          if (!finished) {
            finished = true;
            SpeechRecognition.removeAllListeners().catch(() => {});
            resolve();
          }
        };

        setTimeout(() => {
          SpeechRecognition.stop().catch(() => {});
          done();
        }, 2800);

        SpeechRecognition.addListener('partialResults', (data: any) => {
          if (data.matches) {
            for (const phrase of data.matches) {
              if (this.checkPhrase(phrase.toLowerCase())) {
                SpeechRecognition.stop().catch(() => {});
                done();
                break;
              }
            }
          }
        });

        const result = await SpeechRecognition.start({
          language: 'en-US',
          maxResults: 3,
          prompt: '',
          partialResults: true,
          popup: false
        });

        if (result?.matches) {
          for (const phrase of result.matches) {
            if (this.checkPhrase(phrase.toLowerCase())) {
              break;
            }
          }
        }
        done();
      } catch {
        resolve();
      }
    });
  }

  private checkPhrase(text: string): boolean {
    const triggerIndex = text.indexOf('hey friday');
    const fridayIndex = text.indexOf('friday');

    let matchedTrigger = '';
    let remaining = '';

    if (triggerIndex !== -1) {
      matchedTrigger = 'hey friday';
      remaining = text.substring(triggerIndex + 'hey friday'.length).trim();
    } else if (fridayIndex !== -1) {
      matchedTrigger = 'friday';
      remaining = text.substring(fridayIndex + 'friday'.length).trim();
    }

    if (matchedTrigger) {
      this.playChime();
      PermissionsService.hapticTap();
      this.onTriggerCallback?.(matchedTrigger, remaining);
      return true;
    }

    return false;
  }

  private playChime() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {}
  }
}

export const wakeWordService = new WakeWordService();
