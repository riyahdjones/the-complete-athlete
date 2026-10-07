import { Capacitor, registerPlugin } from '@capacitor/core';

const NativePlanAudio = registerPlugin('TCAPlanAudio');

const initialState = {
  status: 'idle',
  planId: '',
  planTitle: '',
  sectionTitle: '',
  sectionIndex: -1,
  mode: 'plan',
  currentTime: 0,
  duration: 0,
  rate: 1,
  error: ''
};

let state = initialState;
let audio = null;
let audioUrl = '';
let playbackId = 0;
let activeConfig = null;
const listeners = new Set();
const audioCache = new Map();

function emit(update) {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener(state));
}

function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

function beginNativeAudioSession() {
  if (!isNativeIOS()) return Promise.resolve();
  return NativePlanAudio.activatePlanAudioSession().catch(() => {});
}

function endNativeAudioSession() {
  if (!isNativeIOS()) return;
  NativePlanAudio.deactivatePlanAudioSession().catch(() => {});
}

function clearAudio() {
  if (audio) {
    audio.onloadedmetadata = null;
    audio.ontimeupdate = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = '';
    audio = null;
  }
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = '';
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.planTitle || 'Performance Plan',
      artist: state.sectionTitle || 'The Complete Athlete',
      album: 'The Complete Athlete'
    });
    navigator.mediaSession.playbackState = state.status === 'playing' ? 'playing' : 'paused';
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration)
      });
    }
  } catch {
    // Media Session support differs between browser and iOS versions.
  }
}

function cacheKey(config, sectionIndex, text) {
  return `${config.language}:${config.planId}:${sectionIndex}:${text.length}:${text.slice(0, 48)}`;
}

async function loadBlob(config, sectionIndex) {
  const text = config.sections[sectionIndex]?.audioText || '';
  const key = cacheKey(config, sectionIndex, text);
  if (!audioCache.has(key)) {
    audioCache.set(key, config.loadAudio(sectionIndex, text).catch((error) => {
      audioCache.delete(key);
      throw error;
    }));
  }
  return audioCache.get(key);
}

function prefetchNext(config, sectionIndex) {
  if (sectionIndex + 1 >= config.sections.length) return;
  loadBlob(config, sectionIndex + 1).catch(() => {});
}

async function playSection(sectionIndex, mode, requestId) {
  const config = activeConfig;
  const section = config?.sections?.[sectionIndex];
  if (!config || !section?.audioText) return;

  clearAudio();
  emit({
    status: 'loading',
    planId: config.planId,
    planTitle: config.planTitle,
    sectionTitle: section.title || 'Current section',
    sectionIndex,
    mode,
    currentTime: 0,
    duration: 0,
    error: ''
  });

  try {
    const blob = await loadBlob(config, sectionIndex);
    if (requestId !== playbackId || config !== activeConfig) return;

    audioUrl = URL.createObjectURL(blob);
    audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.playbackRate = state.rate;
    audio.onloadedmetadata = () => {
      emit({ duration: Number.isFinite(audio?.duration) ? audio.duration : 0 });
      updateMediaSession();
    };
    audio.ontimeupdate = () => {
      if (!audio) return;
      emit({ currentTime: audio.currentTime || 0 });
      updateMediaSession();
    };
    audio.onplay = () => {
      emit({ status: 'playing' });
      updateMediaSession();
    };
    audio.onpause = () => {
      if (state.status !== 'idle' && state.status !== 'loading') emit({ status: 'paused' });
      updateMediaSession();
    };
    audio.onended = () => {
      if (requestId !== playbackId) return;
      const nextSection = sectionIndex + 1;
      if (mode === 'plan' && nextSection < config.sections.length) {
        playSection(nextSection, mode, requestId);
        return;
      }
      clearAudio();
      endNativeAudioSession();
      emit({ status: 'idle', sectionIndex: -1, currentTime: 0, duration: 0 });
      updateMediaSession();
    };
    audio.onerror = () => {
      if (requestId !== playbackId) return;
      clearAudio();
      endNativeAudioSession();
      emit({ status: 'error', error: 'Narrated audio is unavailable right now.' });
    };

    await beginNativeAudioSession();
    if (mode === 'plan') prefetchNext(config, sectionIndex);
    updateMediaSession();
    await audio.play();
  } catch {
    if (requestId !== playbackId) return;
    clearAudio();
    endNativeAudioSession();
    emit({ status: 'error', error: 'Narrated audio is unavailable right now.' });
  }
}

function installMediaActions() {
  if (!('mediaSession' in navigator)) return;
  const actions = {
    play: () => planAudioPlayer.resume(),
    pause: () => planAudioPlayer.pause(),
    stop: () => planAudioPlayer.stop(),
    seekbackward: (details) => planAudioPlayer.seekBy(-(details.seekOffset || 15)),
    seekforward: (details) => planAudioPlayer.seekBy(details.seekOffset || 15)
  };
  Object.entries(actions).forEach(([action, handler]) => {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
  });
}

if (typeof navigator !== 'undefined') installMediaActions();

export const planAudioPlayer = {
  getState() {
    return state;
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  start(config, sectionIndex = 0, mode = 'plan') {
    playbackId += 1;
    activeConfig = config;
    playSection(sectionIndex, mode, playbackId);
  },
  pause() {
    audio?.pause();
  },
  async resume() {
    if (audio) {
      await beginNativeAudioSession();
      try { await audio.play(); } catch { emit({ status: 'error', error: 'Audio could not resume.' }); }
      return;
    }
    if (activeConfig && state.sectionIndex >= 0) {
      playbackId += 1;
      playSection(state.sectionIndex, state.mode, playbackId);
    }
  },
  toggle() {
    if (state.status === 'playing') this.pause();
    else this.resume();
  },
  restart() {
    if (audio) {
      audio.currentTime = 0;
      this.resume();
    } else if (activeConfig) {
      playbackId += 1;
      playSection(Math.max(0, state.sectionIndex), state.mode, playbackId);
    }
  },
  seekBy(seconds) {
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  },
  setRate(rate) {
    const nextRate = Number(rate) || 1;
    if (audio) audio.playbackRate = nextRate;
    emit({ rate: nextRate });
    updateMediaSession();
  },
  stop() {
    playbackId += 1;
    clearAudio();
    endNativeAudioSession();
    activeConfig = null;
    emit(initialState);
    updateMediaSession();
  }
};
