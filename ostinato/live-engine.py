"""Browser inputs and JSON snapshots for Ostinato's Python engine."""

import json
import math

import cv2
import numpy as np

from ostinato.app import EXTRA_VIEWS, WINDOW, Monitor
from ostinato.breathing import MIN_SECONDS
from ostinato.chest import MIN_VISIBILITY, ChestTracker
from ostinato.decision import Action, Assessor
from ostinato.response import PROMPT, ResponseCheck, Speaker, body_from_landmarks


class BrowserPose:
    """Give ChestTracker the same pixel landmarks as its native pose finder."""

    def __init__(self):
        self.landmarks = None
        self.body = None

    def __call__(self, frame):
        self.body = None
        marks = np.asarray(self.landmarks, dtype=float)
        if marks.shape != (33, 3) or not np.isfinite(marks).all():
            return None
        height, width = frame.shape[:2]
        points = marks[:, :2] * [width, height]
        visibility = marks[:, 2]
        self.body = body_from_landmarks(points, visibility, (width, height))
        if min(visibility[11], visibility[12]) < MIN_VISIBILITY:
            return None
        return points[[11, 12, 23, 24]]


class BrowserSpeaker:
    """Wait for a local voice to finish or leave time to read the text prompt."""

    def __init__(self):
        self.use_voice = False
        self.stop()

    def start(self, t):
        self.started = t
        self.done = False
        self.failed = not self.use_voice
        self.text_since = t

    def stop(self):
        self.started = None
        self.done = self.failed = False

    def acknowledge(self, t, success):
        if self.started is not None and not (self.failed or self.done):
            self.done, self.failed = success, not success
            self.text_since = t

    def finished(self, t):
        if not (self.done or self.failed) and t - self.started >= Speaker.TIMEOUT:
            self.acknowledge(t, False)
        return self.done or (self.failed and t - self.text_since >= Speaker.READ_SECONDS)


class BrowserEngine:
    def __init__(self):
        self.pose = BrowserPose()
        self.tracker = ChestTracker(self.pose)
        self.monitor = Monitor(self.tracker)
        self.speaker = BrowserSpeaker()
        self.check = ResponseCheck(self.speaker)
        self.t = 0.0
        self._last_frame = None
        self._size = None
        self._reset()

    def _clear_view(self):
        self.monitor.reset()
        self.monitor.tracking = "starting"
        self.pose.body = None
        self.check.cancel()
        self._view_start = self.t

    def _reset(self):
        self._clear_view()
        self.assessor = Assessor(self.t, EXTRA_VIEWS)

    def frame(self, t, width, height, pixels, landmarks):
        """Handle one ordered frame. The worker supplies RGBA and normalized pose."""
        if not math.isfinite(t) or t < self.t:
            raise ValueError("frame time must be finite and ordered")
        if self._last_frame is not None and t <= self._last_frame:
            return self.snapshot()

        rgba = np.frombuffer(pixels, dtype=np.uint8).reshape(height, width, 4)
        bgr = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGR)
        size = (width, height)
        self.t = self._last_frame = t
        if self._size is not None and size != self._size:
            self._clear_view()
        self._size = size

        self.pose.landmarks = landmarks
        try:
            reading = self.monitor.update(bgr, t)
        finally:
            self.pose.landmarks = None
        responded = self.check.update(t, self.pose.body)
        decision = self.assessor.update(t, reading, responded, asking=self.check.active)
        if decision.final and self.check.active:
            self.check.cancel()
        return self.snapshot()

    def command(self, t, action, sound=False):
        """User controls. Anchor changes to the most recently processed frame."""
        if action == "start":
            if not math.isfinite(t) or t < 0:
                raise ValueError("session start time must be finite and nonnegative")
            self.t = t
            self._last_frame = self._size = None
            self._reset()
            return self.snapshot()

        # Speech and button events can arrive while a frame is pending. Advancing the
        # frame clock would skip that frame or move Assessor's clock backwards.
        t = self.t
        decision = self.assessor.decision
        if action == "prompt":
            if self._last_frame is not None and not (decision.final or self.check.active):
                self.speaker.use_voice = sound
                self.check.ask(t)
        elif action in ("speech_done", "speech_failed"):
            if self.check.state == "speaking":
                self.speaker.acknowledge(t, action == "speech_done")
        elif action == "new_view":
            if decision.action is Action.MOVE:
                self.assessor.arrived(t)
                self._clear_view()
        elif action == "move_failed":
            if decision.action is Action.MOVE:
                self.assessor.move_failed(t)
                self._clear_view()
        elif action == "reset":
            self._reset()
        elif action != "snapshot":
            raise ValueError(f"unknown action: {action}")
        return self.snapshot()

    def snapshot(self):
        reading = self.monitor.reading
        decision = self.assessor.decision
        message = self.check.message()
        samples = [
            [t, float(value) if math.isfinite(value) else None]
            for t, value in self.monitor.samples
        ]
        box = self.tracker.box
        moving = decision.action is Action.MOVE
        return json.dumps({
            "t": self.t,
            "elapsed": self.t - self._view_start,
            "window": WINDOW,
            "min_seconds": MIN_SECONDS,
            "view": EXTRA_VIEWS + 1 - self.assessor.views_left - moving,
            "views": EXTRA_VIEWS + 1,
            "reading": {
                "bpm": reading.bpm,
                "confidence": reading.confidence,
                "reason": reading.reason,
                "status": reading.status,
            },
            "decision": {
                "action": decision.action.value,
                "status": decision.status.value,
                "reason": decision.reason,
                "bpm": decision.bpm,
                "final": decision.final,
                "completed_at_s": decision.completed_at_s,
            },
            "prompt": {
                "state": self.check.state,
                "outcome": self.check.outcome,
                "headline": message[0] if message else None,
                "detail": message[1] if message else None,
                "text": PROMPT,
            },
            "tracking": self.monitor.tracking,
            "samples": samples,
            "box": box[:4] if box is not None else None,
        }, allow_nan=False)


engine = BrowserEngine()
