'use strict';

const byId = (id) => document.getElementById(id);
const video = byId('camera');
const sample = byId('sample');
const overlay = byId('tracking-box');
const chart = byId('chart');
const buttons = {
  camera: byId('start-camera'),
  sample: byId('start-sample'),
  stop: byId('stop'),
  prompt: byId('prompt'),
  new_view: byId('new-view'),
  move_failed: byId('move-failed'),
  reset: byId('reset'),
};
const frameInterval = 1000 / 12;
const origin = performance.now();
const timestamp = () => (performance.now() - origin) / 1000;

let session = null;
let lastState = null;

function setText(id, text) {
  const element = byId(id);
  if (element.textContent !== text) element.textContent = text;
}

function status(text, error = false) {
  setText('status', text);
  byId('status').dataset.error = String(error);
}

function updateControls() {
  const decision = lastState?.decision;
  const running = session?.started && !session.starting;
  const available = running && !session.command;
  const isMove = decision?.action === 'move';
  buttons.camera.disabled = Boolean(session);
  buttons.sample.disabled = Boolean(session);
  buttons.stop.disabled = !session;
  buttons.prompt.disabled = !available || !session.hasFrame || decision?.final ||
    isMove || ['speaking', 'watching'].includes(lastState?.prompt.state);
  buttons.new_view.disabled = !available || !isMove;
  buttons.move_failed.disabled = !available || !isMove;
  buttons.reset.disabled = !available || !session.hasFrame;
}

function drawChart() {
  const width = chart.clientWidth;
  const height = chart.clientHeight;
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (chart.width !== pixelWidth || chart.height !== pixelHeight) {
    chart.width = pixelWidth;
    chart.height = pixelHeight;
  }

  const ctx = chart.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#c5d3e4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const y of [height / 6, height / 2, height * 5 / 6]) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  const values = lastState?.samples.map((entry) => entry[1]).filter(Number.isFinite) || [];
  if (values.length < 2) return;
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const range = Math.max(top - bottom, 1e-6);
  const windowSize = lastState.window;
  const first = lastState.t - windowSize;
  ctx.strokeStyle = '#294bc9';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  let connected = false;
  for (const [t, value] of lastState.samples) {
    if (t < first || !Number.isFinite(value)) {
      connected = false;
      continue;
    }
    const x = (t - first) * width / windowSize;
    const y = height * (.86 - .72 * (value - bottom) / range);
    if (connected) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    connected = true;
  }
  ctx.stroke();
}

function drawTracking(box) {
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!box?.every(Number.isFinite)) return;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#182f55';
  const [left, top, right, bottom] = box;
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#f9fcff';
  ctx.strokeRect(left, top, right - left, bottom - top);
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function render(state) {
  lastState = state;
  const { decision, reading, prompt } = state;
  const hasRate = Number.isFinite(reading.bpm);
  let headline = 'Assessing';
  let detail = capitalize(decision.reason);

  if (prompt.headline) {
    const textOnly = prompt.detail?.startsWith('Voice unavailable');
    headline = prompt.state === 'watching' ? 'Watching for a hand raise' : prompt.text;
    if (session.mode === 'sample') {
      detail = 'The sample will simulate a hand raise.';
    } else if (prompt.state === 'watching') {
      detail = 'Show one wrist below your shoulder, then raise it and hold.';
    } else {
      detail = textOnly ? 'Read this prompt aloud to the person in view.' : 'Playing the prompt with a voice from this device.';
    }
  } else if (decision.action === 'move') {
    headline = 'Move the camera to a new view';
    detail = `${detail}. Confirm when the camera is still again.`;
  } else if (decision.action === 'get help') {
    headline = 'A person needs to check';
    detail = `${capitalize(decision.status)} · ${decision.reason}`;
  } else if (decision.action === 'report') {
    headline = Number.isFinite(decision.bpm)
      ? `Past result · ${decision.bpm.toFixed(1)} breaths/min`
      : `Past result · ${decision.status}`;
  }

  const waiting = reading.reason === 'need more data';
  const estimateDetail = waiting
    ? `Collecting steady motion · ${Math.min(Math.floor(state.elapsed), state.min_seconds)} / ${state.min_seconds} s`
    : capitalize(reading.reason);
  setText('headline', headline);
  setText('detail', detail);
  setText('reading', hasRate ? `${reading.bpm.toFixed(1)} breaths/min` : 'Unable to assess');
  setText('reading-detail', hasRate ? `Signal score ${reading.confidence.toFixed(2)}` : estimateDetail);
  setText('view', `${state.view} of ${state.views}`);
  setText('chart-note', `Chest motion · last ${state.window} seconds`);
  setText('response', prompt.outcome === 'response' ? 'Hand raise seen'
    : prompt.outcome === 'none seen' ? 'None seen · inconclusive'
    : prompt.state === 'watching' ? 'Watching for a hand raise'
    : prompt.state === 'speaking' ? 'Showing prompt'
    : 'Not asked yet');
  drawTracking(state.box);
  drawChart();
  updateControls();
}

function showSource(mode) {
  byId('placeholder').hidden = Boolean(mode);
  video.hidden = mode !== 'camera';
  sample.hidden = mode !== 'sample';
  overlay.hidden = !mode;
  byId('source-state').dataset.active = String(Boolean(mode));
  setText('source-state', mode === 'camera' ? 'Camera on' : mode === 'sample' ? 'Synthetic sample' : 'Off');
}

function stop(message = 'Frames are processed in this browser.', error = false) {
  const previous = session;
  session = null;
  clearTimeout(previous?.timer);
  if (previous) cancelSpeech(previous);
  previous?.worker?.terminate();
  previous?.stream?.getTracks().forEach((track) => track.stop());
  video.pause();
  video.srcObject = null;
  showSource(null);
  lastState = null;
  setText('headline', 'Ready to start');
  setText('detail', 'Choose a video source to begin an assessment.');
  setText('reading', '—');
  setText('reading-detail', 'Waiting for video.');
  setText('view', '—');
  setText('response', '—');
  status(message, error);
  updateControls();
  drawTracking(null);
  drawChart();
}

function onWorkerMessage(owner, data) {
  if (owner !== session) return;
  if (data.type === 'status') {
    if (owner.sourceReady) status(data.message);
    return;
  }
  if (data.type === 'ready') {
    owner.ready = true;
    beginFrames(owner);
    return;
  }
  if (data.type === 'error' && data.requestType === 'init') {
    stop(data.message, true);
    return;
  }
  if (data.requestType === 'frame') {
    owner.framePending = false;
    if (data.type === 'error') {
      stop(data.message, true);
      return;
    }
    if (!owner.hasFrame) {
      owner.hasFrame = true;
      status(owner.mode === 'camera'
        ? 'Camera frames are being processed on this device.'
        : 'Generated sample · 15 breaths/min reference.');
      sendCommand('start');
      return;
    }
    if (data.state.prompt.state !== 'speaking') cancelSpeech(owner);
    render(data.state);
    scheduleFrame(owner);
    return;
  }
  if (data.requestType === 'command' && owner.command?.t === data.t) {
    const { voice } = owner.command;
    owner.command = null;
    if (data.type === 'error') {
      stop(data.message, true);
      return;
    }
    owner.starting = false;
    if (data.action === 'prompt' && owner.mode === 'sample') owner.samplePromptAt = data.state.t;
    if (['reset', 'new_view', 'move_failed'].includes(data.action)) owner.samplePromptAt = null;
    render(data.state);
    if (voice && data.state.prompt.state === 'speaking') speak(owner, voice, data.state.prompt.text);
    scheduleFrame(owner);
  }
}

function openWorker(owner) {
  owner.worker = new Worker('./live-worker.js');
  owner.worker.addEventListener('message', ({ data }) => onWorkerMessage(owner, data));
  owner.worker.addEventListener('error', () => {
    if (owner === session) stop('The assessment engine could not load. Try again.', true);
  });
  owner.worker.postMessage({ type: 'init' });
}

function scheduleFrame(owner) {
  if (!owner.started || owner !== session || owner.framePending || owner.command || owner.timer) return;
  const delay = Math.max(0, frameInterval - (performance.now() - owner.lastFrameAt));
  owner.timer = setTimeout(() => {
    owner.timer = null;
    submitFrame(owner);
  }, delay);
}

function scaleCameraFrame() {
  const scale = Math.min(1, 640 / video.videoWidth, 480 / video.videoHeight);
  return [Math.max(1, Math.round(video.videoWidth * scale)), Math.max(1, Math.round(video.videoHeight * scale))];
}

async function submitFrame(owner) {
  if (owner !== session || owner.command || owner.framePending) return;
  owner.lastFrameAt = performance.now();
  if (owner.mode === 'camera' && (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === owner.videoTime
  )) {
    scheduleFrame(owner);
    return;
  }

  owner.framePending = true;
  const t = timestamp();
  try {
    if (owner.mode === 'camera') {
      owner.videoTime = video.currentTime;
      const [width, height] = scaleCameraFrame();
      const bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: height });
      if (owner !== session) {
        bitmap.close();
        return;
      }
      if (overlay.width !== bitmap.width || overlay.height !== bitmap.height) {
        overlay.width = bitmap.width;
        overlay.height = bitmap.height;
      }
      owner.worker.postMessage({ type: 'frame', t, bitmap }, [bitmap]);
    } else {
      const { pixels, landmarks } = drawSample(t, owner);
      owner.worker.postMessage({ type: 'frame', t, width: sample.width, height: sample.height, pixels, landmarks }, [pixels]);
    }
  } catch {
    if (owner === session) stop('The video frame could not be captured. Restart the input to try again.', true);
  }
}

function beginFrames(owner) {
  if (owner !== session || !owner.sourceReady || !owner.ready || owner.started) return;
  owner.started = true;
  owner.sampleStartedAt = timestamp();
  scheduleFrame(owner);
}

function sendCommand(action) {
  const owner = session;
  if (!owner || owner.command) return;
  if (action === 'reset') cancelSpeech(owner);
  const voice = action === 'prompt' && owner.mode === 'camera' ? localVoice() : null;
  const t = timestamp();
  owner.command = { t, voice };
  updateControls();
  owner.worker.postMessage({ type: 'command', t, action, sound: Boolean(voice) });
}

function localVoice() {
  if (!window.SpeechSynthesisUtterance) return null;
  return window.speechSynthesis?.getVoices().find((voice) =>
    voice.localService && /^en(?:-|$)/i.test(voice.lang)) || null;
}

function cancelSpeech(owner) {
  if (!owner.utterance) return;
  owner.utterance.onend = null;
  owner.utterance.onerror = null;
  owner.utterance = null;
  window.speechSynthesis.cancel();
}

function speak(owner, voice, text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  const finish = (action) => {
    if (owner !== session || owner.utterance !== utterance) return;
    owner.utterance = null;
    sendCommand(action);
  };
  utterance.onend = () => finish('speech_done');
  utterance.onerror = () => finish('speech_failed');
  owner.utterance = utterance;
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    finish('speech_failed');
  }
}

function cameraError(error) {
  if (error.name === 'NotAllowedError') return 'Camera access was denied. You can allow access in your browser or try the sample.';
  if (error.name === 'NotFoundError') return 'No camera was found. Connect a camera or try the sample.';
  if (error.name === 'NotReadableError') return 'The camera is unavailable. Close other apps using it or try the sample.';
  return 'The camera could not start. Check your browser settings or try the sample.';
}

async function start(mode) {
  if (session) return;
  if (mode === 'camera' && (!navigator.mediaDevices?.getUserMedia || !window.createImageBitmap)) {
    status('Camera access requires a supported browser on HTTPS or localhost. You can still try the sample.', true);
    return;
  }
  const owner = {
    mode, started: false, starting: true, sourceReady: false, hasFrame: false,
    lastFrameAt: -Infinity, videoTime: -1, samplePromptAt: null,
  };
  session = owner;
  updateControls();
  status(mode === 'camera' ? 'Waiting for camera permission…' : 'Loading the assessment engine…');
  try {
    openWorker(owner);
  } catch {
    stop('The assessment engine could not start. Try again.', true);
    return;
  }

  if (mode === 'camera') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (owner !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      owner.stream = stream;
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => {
          if (owner === session) stop('The camera disconnected. Restart it or try the sample.', true);
        });
      }
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      if (owner === session) stop(cameraError(error), true);
      return;
    }
  }
  if (owner !== session) return;
  if (mode === 'sample') {
    overlay.width = sample.width;
    overlay.height = sample.height;
  }
  drawTracking(null);
  showSource(mode);
  owner.sourceReady = true;
  status(owner.ready ? 'Starting the assessment…' : 'Loading the assessment engine…');
  beginFrames(owner);
}

function seededTexture(width, height, background) {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const ctx = surface.getContext('2d');
  const palette = background
    ? ['#bec9d6', '#8094ac', '#d3dce8', '#9cacc1']
    : ['#6682ac', '#3d5377', '#b5c8df', '#819bc0'];
  let seed = 19357;
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      ctx.fillStyle = palette[seed >>> 30];
      ctx.fillRect(x, y, 4, 4);
    }
  }
  return surface;
}

const sampleContext = sample.getContext('2d', { willReadFrequently: true });
const sampleBackdrop = seededTexture(sample.width, sample.height, true);
const sampleShirt = seededTexture(224, 166, false);

function drawSample(t, owner) {
  const ctx = sampleContext;
  const elapsed = t - owner.sampleStartedAt;
  const displacement = 3 * Math.sin(2 * Math.PI * .25 * elapsed);
  const promptWait = owner.samplePromptAt === null ? -1 : t - owner.samplePromptAt;
  const raised = promptWait >= 4.75 && promptWait <= 7.5;
  ctx.drawImage(sampleBackdrop, 0, 0);

  ctx.fillStyle = '#263a55';
  ctx.beginPath();
  ctx.roundRect(144, 105, 192, 157, 26);
  ctx.fill();
  ctx.fillStyle = '#cedbec';
  ctx.beginPath();
  ctx.ellipse(240, 72, 28, 38, 0, 0, 2 * Math.PI);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.rect(157, 113, 166, 128);
  ctx.clip();
  ctx.drawImage(sampleShirt, 130, 100 + displacement);
  ctx.restore();

  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#263a55';
  ctx.beginPath();
  ctx.moveTo(168, 111);
  ctx.lineTo(144, 160);
  ctx.lineTo(raised ? 144 : 168, raised ? 50 : 266);
  ctx.moveTo(312, 111);
  ctx.lineTo(335, 160);
  ctx.lineTo(312, 266);
  ctx.stroke();
  ctx.fillStyle = '#cedbec';
  for (const [x, y] of [[raised ? 144 : 168, raised ? 50 : 266], [312, 266]]) {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, 2 * Math.PI);
    ctx.fill();
  }

  const landmarks = Array.from({ length: 33 }, () => [0, 0, 0]);
  landmarks[0] = [.50, .19, 1];
  landmarks[11] = [.35, .30, 1];
  landmarks[12] = [.65, .30, 1];
  landmarks[15] = raised ? [.30, .14, 1] : [.35, .74, 1];
  landmarks[16] = [.65, .74, 1];
  landmarks[23] = [.38, .67, 1];
  landmarks[24] = [.62, .67, 1];
  return { pixels: ctx.getImageData(0, 0, sample.width, sample.height).data.buffer, landmarks };
}

buttons.camera.addEventListener('click', () => start('camera'));
buttons.sample.addEventListener('click', () => start('sample'));
buttons.stop.addEventListener('click', () => stop());
for (const action of ['prompt', 'new_view', 'move_failed', 'reset']) {
  buttons[action].addEventListener('click', () => sendCommand(action));
}
window.addEventListener('pagehide', () => stop());
if (window.ResizeObserver) new ResizeObserver(drawChart).observe(chart);
else window.addEventListener('resize', drawChart);
