import TimerWorker from "worker-loader!./timer.worker";

let ctx = new AudioContext(),
  unlocked = false,
  isPlaying = false,
  current16thNote = 0,
  tempo = 120,
  lookahead = 25.0,
  scheduleAheadTime = 0.1,
  nextNoteTime = 0.0,
  noteResolution = 0,
  noteLength = 0.05, // length of "beep" (in seconds)
  notesInQueue: { note: number; time: number }[] = [],
  timerWorker = new TimerWorker();

function nextNote() {
  const secondsPerBeat = 60.0 / tempo;

  nextNoteTime += 0.25 * secondsPerBeat; // Add beat length to last beat time

  current16thNote++; // Advance the beat number, wrap to zero;

  if (current16thNote === 16) {
    current16thNote = 0;
  }
}

function scheduleNote(beatNumber: number, time: number) {
  notesInQueue.push({ note: beatNumber, time });

  if (noteResolution == 1 && beatNumber % 2) return; // we're not playing non-8th 16th notes
  if (noteResolution == 2 && beatNumber % 4) return; // we're not playing non-quarter 8th notes

  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);

  if (beatNumber % 16 === 0)
    // beat 0 === high pitch
    osc.frequency.value = 880.0;
  else if (beatNumber % 4 === 0)
    // quarter notes = medium pitch
    osc.frequency.value = 440.0;
  else osc.frequency.value = 220.0; // other 16th notes = low pitch:

  osc.start(time);
  osc.stop(time + noteLength);
}

function scheduler() {
  console.log(nextNoteTime, ctx.currentTime, scheduleAheadTime);
  while (nextNoteTime < ctx.currentTime + scheduleAheadTime) {
    scheduleNote(current16thNote, nextNoteTime);
    nextNote();
  }
}

function play() {
  if (!unlocked) {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const node = ctx.createBufferSource();

    node.buffer = buffer;
    node.start(0);
    unlocked = true;
  }

  isPlaying = !isPlaying;

  if (isPlaying) {
    current16thNote = 0;
    nextNoteTime = ctx.currentTime;
    timerWorker.postMessage("start");
    return "stop";
  } else {
    timerWorker.postMessage("stop");
    return "play";
  }
}

function init() {
  timerWorker.onmessage = function (e: MessageEvent) {
    if (e.data === "tick") {
      scheduler();
    } else {
      console.log("message: " + e.data);
    }
  };

  timerWorker.postMessage({ interval: lookahead });

  document.getElementById("btn").addEventListener("click", function() {
    this.innerHTML = play();
  });
}

window.addEventListener("load", init);
