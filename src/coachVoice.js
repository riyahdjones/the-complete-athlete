import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeVoiceCoach = registerPlugin('TCAVoiceCoach');

function browserRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function createCoachVoiceController({
  locale = 'en-US',
  onTranscript = () => {},
  onListeningChange = () => {},
  onSpeakingChange = () => {},
  onError = () => {}
} = {}) {
  const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const BrowserRecognition = browserRecognitionConstructor();
  let recognition = null;
  let utterance = null;
  let latestTranscript = '';
  let finalDelivered = false;
  let submitOnRecognitionEnd = true;
  let destroyed = false;
  let nativeHandles = [];

  function friendlyError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    if (message.includes('denied') || message.includes('not-allowed') || message.includes('permission')) {
      return 'Microphone access is off. Allow Microphone and Speech Recognition in iPhone Settings, then try again.';
    }
    if (message.includes('network')) return 'Voice recognition needs a connection. Check your signal and try again.';
    if (message.includes('no-speech')) return 'I did not hear anything. Tap the microphone and try again.';
    return 'Voice Coach could not start. Please try again.';
  }

  function reportError(error) {
    if (destroyed) return;
    onError(friendlyError(error));
  }

  function deliverTranscript(text, isFinal = false) {
    const clean = String(text || '').trim();
    if (!clean || destroyed) return;
    latestTranscript = clean;
    if (isFinal) {
      if (finalDelivered) return;
      finalDelivered = true;
    }
    onTranscript(clean, isFinal);
  }

  const nativeReady = native
    ? Promise.all([
        NativeVoiceCoach.addListener('voiceTranscript', ({ text, isFinal }) => deliverTranscript(text, Boolean(isFinal))),
        NativeVoiceCoach.addListener('voiceListening', ({ active }) => onListeningChange(Boolean(active))),
        NativeVoiceCoach.addListener('voiceSpeaking', ({ active }) => onSpeakingChange(Boolean(active))),
        NativeVoiceCoach.addListener('voiceError', ({ message }) => reportError(message))
      ]).then((handles) => {
        nativeHandles = handles;
      })
    : Promise.resolve();

  function isSupported() {
    if (native) return true;
    return Boolean(
      typeof window !== 'undefined'
      && BrowserRecognition
      && typeof window.speechSynthesis !== 'undefined'
      && typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  async function requestPermissions() {
    if (!native) return true;
    await nativeReady;
    const permissions = await NativeVoiceCoach.requestPermissions();
    if (!permissions?.speech || !permissions?.microphone) {
      throw new Error('Microphone or speech recognition permission denied.');
    }
    return true;
  }

  async function startListening() {
    if (!isSupported()) throw new Error('Voice recognition is unavailable on this device.');
    await stopSpeaking();
    latestTranscript = '';
    finalDelivered = false;
    submitOnRecognitionEnd = true;

    if (native) {
      await requestPermissions();
      await NativeVoiceCoach.startListening({ locale });
      return;
    }

    recognition?.abort?.();
    recognition = new BrowserRecognition();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => onListeningChange(true);
    recognition.onresult = (event) => {
      const results = Array.from(event.results || []);
      const text = results.map((result) => result?.[0]?.transcript || '').join(' ').trim();
      const isFinal = results.length > 0 && results.every((result) => result.isFinal);
      deliverTranscript(text, isFinal);
    };
    recognition.onerror = (event) => {
      if (event?.error !== 'aborted') reportError(event?.error || 'Voice recognition failed.');
    };
    recognition.onend = () => {
      onListeningChange(false);
      if (submitOnRecognitionEnd && latestTranscript && !finalDelivered) deliverTranscript(latestTranscript, true);
    };
    recognition.start();
  }

  async function stopListening({ submit = true } = {}) {
    submitOnRecognitionEnd = submit;
    if (native) {
      await nativeReady;
      const result = await NativeVoiceCoach.stopListening();
      onListeningChange(false);
      if (submit && result?.text && !finalDelivered) deliverTranscript(result.text, true);
      return String(result?.text || latestTranscript || '').trim();
    }
    recognition?.stop?.();
    onListeningChange(false);
    if (submit && latestTranscript && !finalDelivered) deliverTranscript(latestTranscript, true);
    return latestTranscript;
  }

  async function speak(text, { rate = 0.5 } = {}) {
    const clean = String(text || '').trim();
    if (!clean) return;
    await stopListening({ submit: false });

    if (native) {
      await nativeReady;
      await NativeVoiceCoach.speak({ text: clean, locale, rate });
      return;
    }

    window.speechSynthesis.cancel();
    utterance = new window.SpeechSynthesisUtterance(clean);
    utterance.lang = locale;
    utterance.rate = Math.max(0.75, Math.min(1.15, rate * 2));
    utterance.onstart = () => onSpeakingChange(true);
    utterance.onend = () => onSpeakingChange(false);
    utterance.onerror = (event) => {
      onSpeakingChange(false);
      if (event?.error !== 'canceled' && event?.error !== 'interrupted') reportError(event?.error || 'Voice playback failed.');
    };
    window.speechSynthesis.speak(utterance);
  }

  async function stopSpeaking() {
    if (native) {
      await nativeReady;
      await NativeVoiceCoach.stopSpeaking();
      onSpeakingChange(false);
      return;
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel?.();
    utterance = null;
    onSpeakingChange(false);
  }

  async function destroy() {
    destroyed = true;
    try {
      await stopListening({ submit: false });
      await stopSpeaking();
    } catch {
      // Cleanup should never interrupt navigation.
    }
    await Promise.all(nativeHandles.map((handle) => handle?.remove?.()));
    nativeHandles = [];
    recognition = null;
    utterance = null;
  }

  return {
    destroy,
    isSupported,
    requestPermissions,
    speak,
    startListening,
    stopListening,
    stopSpeaking
  };
}
