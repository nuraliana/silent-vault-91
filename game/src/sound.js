// Sounds, synthesized with WebAudio (no files). The audio context only starts
// after the first user gesture, so nothing plays before the player touches the
// game. M toggles mute. Every effect is a short oscillator blip with an envelope.

export function createSound() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') context.resume();
    return context;
  }

  function blip(freq, seconds, type, gain, when) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain || 0.12, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  return {
    /** The context starts on this call (a user gesture). */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.12);
      blip(1318, 0.14, 'sine', 0.1, 0.07);
    },
    crack() {
      blip(2200, 0.04, 'square', 0.05);
    },
    vaultOpen() {
      blip(523, 0.15, 'triangle', 0.12);
      blip(659, 0.15, 'triangle', 0.12, 0.1);
      blip(784, 0.25, 'triangle', 0.12, 0.2);
    },
    spotted() {
      blip(220, 0.35, 'sawtooth', 0.14);
      blip(233, 0.35, 'sawtooth', 0.14, 0.05);
    },
    siren() {
      blip(660, 0.2, 'square', 0.06);
      blip(440, 0.2, 'square', 0.06, 0.2);
    },
    caught() {
      blip(330, 0.3, 'sawtooth', 0.14);
      blip(165, 0.5, 'sawtooth', 0.14, 0.2);
    },
    tool() {
      blip(1046, 0.1, 'sine', 0.1);
      blip(784, 0.18, 'sine', 0.1, 0.08);
    },
    win() {
      blip(523, 0.2, 'triangle', 0.12);
      blip(659, 0.2, 'triangle', 0.12, 0.15);
      blip(784, 0.2, 'triangle', 0.12, 0.3);
      blip(1046, 0.4, 'triangle', 0.12, 0.45);
    },
  };
}
