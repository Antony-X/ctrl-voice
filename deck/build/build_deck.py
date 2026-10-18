"""Builds the Ctrl+Voice hackathon pitch deck (13 slides + 1 hidden appendix, 3:00) with PowerPoint
itself over COM, without a window.

Everything that shows the demo message comes from media/ (see SWAP.md):
  media/deck_data.json   transcript, cuts, waveform, durations   (prep_data.py)
  media/messy.wav        the message as spoken
  media/fixed.wav        what Ctrl+Voice sent
  media/clips/*.mp4      clips of the real app UI                 (make_videos.py)
  media/screen.mp4       optional: a real, unedited screen recording (slide 8)
  build/config.json      names, event, tagline, placeholder flag

Steps: build -> save -> inject the Morph transition (slide 5) -> reopen in PowerPoint, check, save the
final .pptx -> export PNGs to render/ -> optional preview video of the whole talk (--video).

Usage: python build_deck.py [--video] [--out PATH]
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from xml.dom import minidom

import pythoncom
import win32com.client

BUILD = Path(__file__).resolve().parent
DECK = BUILD.parent
MEDIA = DECK / "media"
CLIPS = MEDIA / "clips"
OUT = BUILD / "out"
RENDER = DECK / "render"
FINAL = Path(os.environ["USERPROFILE"]) / "Downloads" / "Ctrl+Voice — Hackathon Pitch (final).pptx"

W, H, MX = 960, 540, 56
# the app's dark theme (src/app/styles.css)
STAGE, PANEL, PANEL2, GLASS, LINE = "171716", "201F1E", "2A2927", "33322F", "34322F"
INK, INK2, INK3, INK4 = "F3F2EE", "A8A49C", "75716A", "4A4844"
MADE, AMBER, RED = "4CC89B", "F0A73A", "FF453A"
T_CONF, T_CALM, T_WARM = "7088FF", "4CC2AA", "F0A24A"
SERIF_D, SERIF_T = "Sitka Display", "Sitka Text"
SANS, SANS_SB, SANS_L = "Segoe UI", "Segoe UI Semibold", "Segoe UI Light"

# slide lengths in seconds; they sum to 180
SLOTS = [7, 12, 22, 8, 13, 12, 16, 10, 14, 20, 12, 12, 12, 10]


def rgb(h):
    return int(h[0:2], 16) | int(h[2:4], 16) << 8 | int(h[4:6], 16) << 16


def mmss(t):
    return f"{int(t // 60)}:{int(t % 60):02d}"


class Slide:
    def __init__(self, pres, k):
        self.k = k
        self.s = pres.Slides.Add(pres.Slides.Count + 1, 12)
        self.s.FollowMasterBackground = -1
        self.seq = self.s.TimeLine.MainSequence
        tr = self.s.SlideShowTransition
        tr.EntryEffect = 3849          # fade
        tr.Duration = 0.5
        self.uid = 0

    def _name(self, shp, name):
        self.uid += 1
        shp.Name = name or f"s{self.k}_{self.uid}"
        return shp

    # ---------------------------------------------------------------- shapes
    def text(self, x, y, w, h, text, size=16, font=SANS, color=INK, align="l", anchor="t", line=None,
             spacing=None, italic=False, name=None, wrap=True, fit=False, runs=()):
        tb = self.s.Shapes.AddTextbox(1, x, y, w, h)
        tf = tb.TextFrame
        tf.MarginLeft = tf.MarginRight = tf.MarginTop = tf.MarginBottom = 0
        tf.WordWrap = -1 if wrap else 0
        tf.AutoSize = 1 if fit else 0
        tf.VerticalAnchor = {"t": 1, "m": 3, "b": 4}[anchor]
        tr = tf.TextRange
        tr.Text = text.replace("\n", "\r")
        f = tr.Font
        f.Name, f.Size, f.Bold, f.Italic = font, size, 0, -1 if italic else 0
        f.Color.RGB = rgb(color)
        pf = tr.ParagraphFormat
        pf.Alignment = {"l": 1, "c": 2, "r": 3}[align]
        pf.SpaceBefore = pf.SpaceAfter = 0
        if line:
            pf.LineRuleWithin = -1
            pf.SpaceWithin = line
        if spacing:
            tb.TextFrame2.TextRange.Font.Spacing = spacing
        if not fit:
            tb.Left, tb.Top, tb.Width, tb.Height = x, y, w, h   # AddTextbox shrinks the box to one line
        pos = 0
        for sub, o in runs:
            i = text.find(sub, pos)
            if i < 0:
                raise ValueError(f"run {sub!r} not in {text!r}")
            pos = i + len(sub)
            r = tr.Characters(i + 1, len(sub))
            if "color" in o:
                r.Font.Color.RGB = rgb(o["color"])
            if "font" in o:
                r.Font.Name = o["font"]
            if "size" in o:
                r.Font.Size = o["size"]
            if "italic" in o:
                r.Font.Italic = -1 if o["italic"] else 0
            if o.get("strike"):
                chars2(tb, i + 1, len(sub)).Font.Strike = 1
        return self._name(tb, name)

    def measure(self, text, size, font=SANS, spacing=None):
        tb = self.text(0, 0, 10, 10, text, size=size, font=font, wrap=False, fit=True, spacing=spacing)
        w = tb.Width
        tb.Delete()
        return w

    def rect(self, x, y, w, h, fill=None, r=0, line=None, lw=0.75, alpha=0, name=None, dash=None, shape=None):
        shp = self.s.Shapes.AddShape(shape or (5 if r else 1), x, y, w, h)
        if r and not shape:
            shp.Adjustments.SetItem(1, min(0.5, r / min(w, h)))
        if fill:
            shp.Fill.Visible = -1
            shp.Fill.Solid()
            shp.Fill.ForeColor.RGB = rgb(fill)
            shp.Fill.Transparency = alpha
        else:
            shp.Fill.Visible = 0
        if line:
            shp.Line.Visible = -1
            shp.Line.ForeColor.RGB = rgb(line)
            shp.Line.Weight = lw
            if dash:
                shp.Line.DashStyle = dash
        else:
            shp.Line.Visible = 0
        shp.Shadow.Visible = 0
        return self._name(shp, name)

    def oval(self, x, y, d, fill=None, line=None, lw=1):
        return self.rect(x, y, d, d, fill=fill, line=line, lw=lw, shape=9)

    def tri(self, x, y, w, h, fill):
        t = self.rect(x, y, h, w, fill=fill, shape=7)       # isosceles triangle, rotated to point right
        t.Rotation = 90
        t.Left, t.Top = x + (w - h) / 2, y + (h - w) / 2
        return t

    def line(self, x1, y1, x2, y2, color=INK3, w=1, dash=None, arrow=False, name=None):
        ln = self.s.Shapes.AddLine(x1, y1, x2, y2)
        ln.Line.ForeColor.RGB = rgb(color)
        ln.Line.Weight = w
        if dash:
            ln.Line.DashStyle = dash
        if arrow:
            ln.Line.EndArrowheadStyle = 2
            ln.Line.EndArrowheadLength = 1
            ln.Line.EndArrowheadWidth = 1
        return self._name(ln, name)

    def group(self, shapes, name=None):
        g = self.s.Shapes.Range([s.Name for s in shapes]).Group()
        return self._name(g, name)

    def bars(self, levels, x, cy, w, hmax, color, bw=2.4, names=None, colors=None, alpha=0, hmin=2.4):
        pitch = w / len(levels)
        out = []
        for k, lv in enumerate(levels):
            h = max(hmin, lv * hmax)
            out.append(self.rect(x + k * pitch + (pitch - bw) / 2, cy - h / 2, bw, h, fill=(colors[k] if colors else color),
                                 r=bw / 2, alpha=alpha, name=names[k] if names else None))
        return out

    def media(self, path, x, y, w, h, poster=None, play_at=None, volume=1.0, name=None):
        m = self.s.Shapes.AddMediaObject2(str(path), 0, -1, x, y, w, h)
        if poster:
            m.MediaFormat.SetDisplayPictureFromFile(str(poster))
        m.MediaFormat.Volume = volume
        if x < 0:
            m.Left, m.Top = -120, 20 + 50 * (self.uid % 4)
            m.AnimationSettings.PlaySettings.HideWhileNotPlaying = -1
        if play_at is not None:
            self.anim(m, play_at, "play")
        return self._name(m, name)

    # ---------------------------------------------------------------- animation (all automatic)
    def anim(self, shp, t, kind="fade", dur=0.5, exit=False, direction=None, linear=False):
        eid = {"fade": 10, "wipe": 22, "appear": 1, "play": 83}[kind]
        e = self.seq.AddEffect(shp, eid, 0, 2)                  # with previous: t is seconds from slide start
        if direction:
            e.EffectParameters.Direction = direction
        if kind != "play":
            e.Timing.Duration = dur
        e.Timing.TriggerDelayTime = t
        if exit:
            e.Exit = -1
        if linear:
            e.Timing.SmoothStart = 0
            e.Timing.SmoothEnd = 0
        return e

    def on_click(self, trigger, effects):
        """effects: [(shape, effect id)] run when `trigger` is clicked in the show."""
        iseq = self.s.TimeLine.InteractiveSequences.Add()
        (shp0, e0), rest = effects[0], effects[1:]
        iseq.AddTriggerEffect(shp0, e0, 4, trigger)
        for shp, eid in rest:
            iseq.AddEffect(shp, eid, 0, 2)

    def notes(self, text):
        self.s.NotesPage.Shapes.Placeholders(2).TextFrame.TextRange.Text = text.strip().replace("\n", "\r")

    # ---------------------------------------------------------------- recurring pieces
    def kicker(self, text, x=MX, y=40, color=INK3, w=520, align="l"):
        return self.text(x, y, w, 16, text.upper(), size=10.5, font=SANS_SB, color=color, spacing=1.6, align=align)

    def title(self, text, y=58, size=40, x=MX, w=848, h=60):
        return self.text(x, y, w, h, text, size=size, font=SERIF_D, color=INK, line=0.92)

    def logo(self, x, y, s, color=INK):
        lw = 0.07 * s
        frame = self.rect(x + lw / 2, y + lw / 2, s - lw, s - lw, r=0.2 * s, line=color, lw=lw)
        bw = 0.06 * s
        parts = [frame]
        for cx, y0, y1 in [(22.6, 40.5, 59.5), (36.1, 30, 70), (50, 18.5, 81.5), (63.9, 31, 69), (77.4, 41, 59)]:
            parts.append(self.rect(x + cx / 100 * s - bw / 2, y + y0 / 100 * s - bw / 2, bw, (y1 - y0) / 100 * s + bw,
                                   fill=color, r=bw / 2))
        return self.group(parts)

    def step(self, x, y, num, label, t, w, size=13.5, lit=INK, h=22):
        """A numbered step that lights up at t (dim copy underneath, lit copy fades in)."""
        d = h - 2
        dim = [self.oval(x, y + 1, d, line=INK4, lw=1),
               self.text(x, y + 1, d, d, str(num), size=10, font=SANS_SB, color=INK3, align="c", anchor="m"),
               self.text(x + d + 9, y, w, h, label, size=size, color=INK3, anchor="m", wrap=False)]
        on = [self.oval(x, y + 1, d, fill=lit),
              self.text(x, y + 1, d, d, str(num), size=10, font=SANS_SB, color=STAGE, align="c", anchor="m"),
              self.text(x + d + 9, y, w, h, label, size=size, color=INK, anchor="m", wrap=False)]
        self.group(dim)
        g = self.group(on)
        self.anim(g, t, "fade", 0.35)
        return g


def chars2(tb, start, length):
    """TextFrame2 character range (pywin32 can't call this parameterised property directly)."""
    tr2 = tb.TextFrame2.TextRange
    dispid = tr2._oleobj_.GetIDsOfNames("Characters")
    return win32com.client.Dispatch(tr2._oleobj_.Invoke(dispid, 0, pythoncom.DISPATCH_PROPERTYGET, True, start, length))


# ======================================================================================= slides
class Builder:
    def __init__(self, pres, data, cfg):
        self.pres, self.d, self.cfg = pres, data, cfg
        self.k = 0
        self.ph = bool(cfg.get("placeholder_audio"))
        self.pill = json.loads((CLIPS / "pill.json").read_text("utf-8"))
        self.editor = json.loads((CLIPS / "editor.json").read_text("utf-8"))
        starts = [sum(SLOTS[:i]) for i in range(len(SLOTS))]
        self.slot = [(s, s + n) for s, n in zip(starts, SLOTS)]
        self.levels = [b["lv"] for b in data["bars"]]
        self.cutbar = [b["cut"] for b in data["bars"]]
        self.rep = data.get("replace")

    def new(self):
        self.k += 1
        return Slide(self.pres, self.k)

    def head(self, i):
        a, b = self.slot[i]
        return f"{mmss(a)}–{mmss(b)} ({b - a} s)"

    @property
    def ph_note(self):
        if not self.ph:
            return ""
        return ("\nPLACEHOLDER AUDIO: the voice in this demo is synthetic (F5-TTS cloning a DisfluencySpeech voice; "
                "respeak docs/HANDOFF.md). It is not a recording of you or anyone on the team; don't call it one. "
                "Swap in your own recording before presenting (deck/SWAP.md).")

    # ------------------------------------------------------------------ 1 title
    def s01_title(self):
        sl = self.new()
        sl.logo(MX, 152, 58)
        sl.text(MX + 76, 140, 600, 82, "Ctrl+Voice", size=58, font=SANS_SB, anchor="m")
        sl.text(MX, 246, 848, 50, self.cfg["tagline"], size=36, font=SERIF_D)
        sl.text(MX, 302, 760, 28, "Edit a voice message like text, before you send it. It still sounds like you.",
                size=17, color=INK2)
        cols = [INK4 if c else INK2 for c in self.cutbar]
        g = sl.group(sl.bars(self.levels, MX, 420, 848, 54, None, colors=cols))
        sl.anim(g, 0.2, "wipe", 1.4, direction=4)
        sl.text(MX, 494, 600, 18, f"{self.cfg['event']}  ·  {self.cfg['track']}", size=12, color=INK3)
        sl.notes(f"""
{self.head(0)}
SAY:
"We're Ctrl+Voice. You can edit a voice message like text, before you send it. And it still sounds like you."

ON SCREEN: the waveform of the demo message draws in. The dim bars are the parts Ctrl+Voice will cut later.
One click goes to the next slide; everything on every slide plays by itself.
""")

    # ------------------------------------------------------------------ 2 problem
    def s02_problem(self):
        sl = self.new()
        sl.kicker("The problem")
        sl.title("You can’t edit speech.", size=44)
        top, ph = 148, 250
        # text side
        L = [sl.rect(MX, top, 404, ph, fill=PANEL, r=14, line=LINE),
             sl.kicker("Text", MX + 24, top + 22)]
        L.append(sl.rect(MX + 24, top + 50, 268, 46, fill=PANEL2, r=16))
        key = sl.rect(MX + 24, top + 114, 104, 32, fill=PANEL2, r=7, line=LINE)
        keyt = sl.text(MX + 24, top + 114, 104, 32, "Backspace", size=12, color=INK2, align="c", anchor="m")
        L += [key, keyt, sl.text(MX + 24, top + 196, 360, 30, "A typo: one keystroke.", size=21, font=SERIF_D)]
        sl.anim(sl.group(L), 0.1, "fade", 0.5)
        typo = sl.text(MX + 42, top + 50, 240, 46, "I’m free on Thrusday", size=18, anchor="m")
        c = typo.TextFrame.TextRange.Characters(13, 8)
        und = sl.line(c.BoundLeft, c.BoundTop + c.BoundHeight * 0.86, c.BoundLeft + c.BoundWidth, c.BoundTop + c.BoundHeight * 0.86,
                      color=RED, w=1.5, dash=3)
        fixed = sl.text(MX + 42, top + 50, 240, 46, "I’m free on Thursday", size=18, anchor="m")
        for s in (typo, und):
            sl.anim(s, 0.1, "fade", 0.5)
        kon = sl.group([sl.rect(MX + 24, top + 114, 104, 32, fill=INK, r=7),
                        sl.text(MX + 24, top + 114, 104, 32, "Backspace", size=12, color=STAGE, align="c", anchor="m")])
        sl.anim(kon, 1.2, "fade", 0.12)
        sl.anim(kon, 1.55, "fade", 0.3, exit=True)
        sl.anim(typo, 1.4, "fade", 0.2, exit=True)
        sl.anim(und, 1.4, "fade", 0.2, exit=True)
        sl.anim(fixed, 1.5, "fade", 0.3)
        # voice side
        x0 = 500
        R = [sl.rect(x0, top, 404, ph, fill=PANEL, r=14, line=LINE), sl.kicker("Voice", x0 + 24, top + 22),
             sl.rect(x0 + 24, top + 50, 300, 46, fill=PANEL2, r=23),
             sl.oval(x0 + 31, top + 57, 32, fill=INK)]
        R.append(sl.tri(x0 + 43, top + 66, 11, 14, STAGE))
        lv = self.levels[::6][:30]
        R += sl.bars(lv, x0 + 74, top + 73, 196, 22, INK3, bw=2.2)
        R.append(sl.text(x0 + 276, top + 50, 40, 46, "0:15", size=12, color=INK3, anchor="m"))
        R.append(sl.text(x0 + 24, top + 108, 360, 24, "“I’m free on Thursday… no no no, on Wednesday.”", size=15,
                         font=SERIF_T, italic=True, color=INK2))
        R.append(sl.text(x0 + 24, top + 196, 360, 30, "A slip: re-record, or send it anyway.", size=21, font=SERIF_D))
        sl.anim(sl.group(R), 3.0, "fade", 0.5)
        btns = []
        bx = x0 + 24
        for label in ("Re-record", "Send anyway"):
            bw = sl.measure(label, 12.5) + 30
            btns += [sl.rect(bx, top + 146, bw, 30, r=15, line=INK3, lw=1),
                     sl.text(bx, top + 146, bw, 30, label, size=12.5, color=INK2, align="c", anchor="m")]
            bx += bw + 10
        sl.anim(sl.group(btns), 4.2, "fade", 0.4)
        # stat
        st = [sl.text(MX, 418, 200, 56, "7 billion", size=40, font=SANS_L, anchor="m"),
              sl.text(MX + 196, 418, 600, 56, "voice messages are sent on WhatsApp every day.\nEvery one of them is write-once.",
                      size=15, color=INK2, anchor="m", line=1.1),
              sl.text(MX, 482, 400, 16, "WhatsApp, March 2022", size=10.5, color=INK3)]
        sl.anim(sl.group(st), 6.6, "fade", 0.5)
        sl.notes(f"""
{self.head(1)}
SAY:
"In text, a typo is one keystroke. In a voice note, one slip and you re-record, or send it anyway. And WhatsApp alone carries seven billion voice messages a day. Here's a messy one."

ON SCREEN: Backspace fixes the typo (0:01.5); the voice note appears with Re-record / Send anyway (0:03-0:04); the stat (0:06.5).
SOURCE: WhatsApp blog, "Making voice messages better" (30 March 2022): "Every day on WhatsApp, our users send 7 billion voice messages on average." https://blog.whatsapp.com/making-voice-messages-better (also TechCrunch, 30 March 2022).
""")

    # ------------------------------------------------------------------ 3 live demo (recording bar)
    def s03_demo(self):
        sl = self.new()
        p = self.pill
        sl.kicker("Live demo", 72, 27)
        sl.media(CLIPS / "pill.mp4", 72, 58, 816, 459, poster=CLIPS / "pill_first.png", play_at=0)
        t_done = p["sent_at"] - 1.5
        steps = [("Alt+` and talk", 0.35), ("“Scratch that”", p["strike_at"] or 8), ("Alt+` again", t_done),
                 ("Cleaned and sent", p["sent_at"])]
        widths = [sl.measure(s, 12.5) for s, _ in steps]
        gap = 26
        total = sum(29 + w for w in widths) + gap * (len(steps) - 1)
        x = 888 - total
        for n, ((label, t), w) in enumerate(zip(steps, widths), 1):
            sl.step(x, 23, n, label, t + 0.15, w + 4, size=12.5, lit=MADE if n == 4 else INK)
            x += 29 + w + gap
        ins = p.get("pause_inserted")
        sl.notes(f"""
{self.head(2)}
SAY (stay quiet while the voice note plays; it ends about {p['strike_at'] + 1:.0f} s into the clip):
"... 'Scratch that' was removed while it was still recording. One key, and it's cleaned up and sent."

ON SCREEN: the clip starts by itself. Alt+` opens the recording bar over a chat; the live caption follows the audio; at 0:16 "Also, I talked to Jake ... Scratch that." is struck and disappears; Alt+` again: "Cleaning up..." then "Sent to {self.cfg['send_target']}"; the cleaned file ({self.d['fixed_duration']:.0f} s) lands in the chat. The four steps at the top light up with it.

HOW THE CLIP WAS MADE: the real Ctrl+Voice recording bar (its own HTML/JS), driven offscreen with this message's real transcript and cuts, over a generic chat window. In the app only "scratch that" and Undo strike words live; fillers and the correction are cut when you finish (next slide). The live detector needs a short pause after "scratch that", so the clip adds {ins['sec'] if ins else 0:.2f} s of silence there (the live test did the same). Caption cadence (about 0.9 s per update, 0.45 s behind) is from a live test; the send-step timing is illustrative.
{self.ph_note}
""")

    # ------------------------------------------------------------------ 4/5 before -> after (Morph)
    WAVE_Y, WAVE_H, TX_Y, TX_SIZE, TX_LINE = 414, 50, 92, 26, 1.55

    def _transcript(self, sl, words):
        text = " ".join(w["w"] for w in words)
        tb = sl.text(MX, self.TX_Y, 848, 260, text, size=self.TX_SIZE, font=SERIF_T, line=self.TX_LINE, name="!!transcript")
        tr = tb.TextFrame.TextRange
        boxes, pos = [], 0
        for w in words:
            c = tr.Characters(pos + 1, len(w["w"]))
            boxes.append((c.BoundLeft, c.BoundTop, c.BoundWidth, c.BoundHeight))
            pos += len(w["w"]) + 1
        return tb, boxes

    def s04_before(self):
        sl = self.new()
        d = self.d
        sl.kicker("Before").Name = "!!label"
        tb, boxes = self._transcript(sl, d["words"])
        n = len(self.levels)
        names = [f"!!b{k:03d}" for k in range(n)]
        sl.bars(self.levels, MX, self.WAVE_Y, 848, self.WAVE_H, INK2, names=names)
        sl.text(904 - 120, self.WAVE_Y - 48, 120, 16, f"{d['duration']:.1f} s", size=12, color=INK3, align="r", name="!!dur")
        size, line = self.TX_SIZE, self.TX_LINE
        xmid = 0.711 * size + 0.684 * (line - 1) * 1.2 * size          # x-height middle below a line's top (calibrated)
        times = self._cut_times(d["cuts"])
        pitch = 848 / n
        for c, t in zip(d["cuts"], times):
            segs = {}
            for k in range(c["i"], c["j"] + 1):
                L, T, Wd, Ht = boxes[k]
                s = segs.setdefault(round(T, 1), [L, L + Wd, T])
                s[0], s[1] = min(s[0], L), max(s[1], L + Wd)
            first = True
            for x0, x1, T in segs.values():
                dim = sl.rect(x0 - 3, T + xmid - 0.5 * size, x1 - x0 + 6, size, fill=STAGE, alpha=0.42)
                st = sl.line(x0, T + xmid, x1, T + xmid, color=RED, w=1.75)
                sl.anim(dim, t, "fade", 0.3)
                sl.anim(st, t, "wipe", 0.35, direction=4)
                if first:
                    lab = sl.text(x0, T + xmid - 0.52 * size - 13, 200, 13, c["label"].upper(), size=9, font=SANS_SB,
                                  color=RED, spacing=1.0, wrap=False)
                    sl.anim(lab, t + 0.1, "fade", 0.3)
                    first = False
            ks = [k for k in range(n) if self.cutbar[k] and c["t0"] <= (k + 0.5) * d["bar_sec"] <= c["t1"]]
            if ks:
                reds = [sl.rect(MX + k * pitch + (pitch - 2.4) / 2, self.WAVE_Y - max(2.4, self.levels[k] * self.WAVE_H) / 2,
                                2.4, max(2.4, self.levels[k] * self.WAVE_H), fill=RED, r=1.2) for k in ks]
                sl.anim(sl.group(reds) if len(reds) > 1 else reds[0], t, "fade", 0.3)
        labels = ", ".join(c["label"] for c in d["cuts"])
        corr = next((c["text"] for c in d["cuts"] if c["kind"] == "correction"), None)
        say = ("Here's what it found: the fillers, " + (f"a correction, '{corr.rstrip(',')}', " if corr else "")
               + "and the whole sentence that was taken back.")
        sl.notes(f"""
{self.head(3)}
SAY:
"{say}"

ON SCREEN: each cut is struck and labelled in turn ({labels}) and its stretch of the waveform turns red.
DATA: transcript and cuts are the engine's own output for this message (media/deck_data.json, sid {d.get('sid')}). Nothing on this slide is drawn by hand.
{self.ph_note}
""")

    def _cut_times(self, cuts):
        # fillers first, then the correction, then the taken-back sentence (matches the spoken line)
        order = {"filler": 0, "repetition": 1, "repeat": 1, "correction": 2, "restart": 2, "false_start": 2, "command": 3, "undo": 3}
        base = {0: 1.0, 1: 1.8, 2: 2.4, 3: 4.4}
        seen = {}
        out = []
        for c in cuts:
            g = order.get(c["kind"], 2)
            out.append(base[g] + 0.35 * seen.get(g, 0))
            seen[g] = seen.get(g, 0) + 1
        return out

    def s05_after(self):
        sl = self.new()
        d = self.d
        sl.kicker("After").Name = "!!label"
        kept = [w for w in d["words"] if not w["cut"]]
        self._transcript(sl, kept)
        n = len(self.levels)
        keep = [k for k in range(n) if not self.cutbar[k]]
        span = 848 * d["fixed_duration"] / d["duration"]
        lv = [self.levels[k] for k in keep]
        sl.bars(lv, MX, self.WAVE_Y, span, self.WAVE_H, INK4, names=[f"!!b{k:03d}" for k in keep])
        sl.text(MX + span - 120, self.WAVE_Y - 48, 120, 16, f"{d['fixed_duration']:.1f} s", size=12, color=INK3, align="r", name="!!dur")
        T0 = 1.75                                                          # Morph takes 1.6 s
        head = sl.group(sl.bars(lv, MX, self.WAVE_Y, span, self.WAVE_H, INK))
        # main-sequence effects are added after the click triggers: adding triggers on the same
        # media later rewrites the main sequence (starts become "after previous", durations reset)
        main = [lambda: sl.anim(head, T0, "wipe", d["fixed_duration"], direction=4, linear=True)]
        auto = sl.media(MEDIA / "fixed.wav", -80, 20, 32, 32)
        main.append(lambda: sl.anim(auto, T0, "play"))
        short = d["duration"] - d["fixed_duration"]
        gap = sl.text(MX + span + 20, self.WAVE_Y - 10, 904 - MX - span - 20, 20, f"{short:.1f} s shorter", size=13, color=INK3, align="c")
        main.append(lambda: sl.anim(gap, 1.6, "fade", 0.5))
        cs = self.cfg.get("clean_seconds")
        parts = [f"{len(d['cuts'])} cuts"] + ([f"cleaned in {cs} s"] if cs else []) + ["nothing regenerated: every word is the original audio"]
        stats = sl.text(MX, 470, 600, 20, "  ·  ".join(parts), size=13.5, color=INK2)
        main.append(lambda: sl.anim(stats, 1.8, "fade", 0.5))
        # Before / After buttons (click to play, for Q&A)
        a_messy = sl.media(MEDIA / "messy.wav", -80, 70, 32, 32)
        a_fixed = sl.media(MEDIA / "fixed.wav", -80, 120, 32, 32)
        bx = 904
        btn = {}
        for label in ("After", "Before"):
            bw = sl.measure(label, 12.5) + 44
            bx -= bw
            parts_ = [sl.rect(bx, 465, bw, 30, fill=PANEL2, r=15, line=LINE),
                      sl.tri(bx + 13, 474, 9, 12, INK),
                      sl.text(bx + 28, 465, bw - 32, 30, label, size=12.5, color=INK, anchor="m")]
            btn[label] = sl.group(parts_)
            main.append(lambda g=btn[label]: sl.anim(g, 1.8, "fade", 0.5))
            bx -= 10
        sl.on_click(btn["Before"], [(a_messy, 83), (a_fixed, 85), (auto, 85)])
        sl.on_click(btn["After"], [(a_fixed, 83), (a_messy, 85), (auto, 85)])
        for f in main:
            f()
        cs_txt = f" in {cs} s" if cs else ""
        sl.notes(f"""
{self.head(4)}
SAY (after the audio, about 10 s into the slide):
"{d['duration']:.0f} seconds down to {d['fixed_duration']:.0f}, cleaned{cs_txt.replace(' s', ' seconds')}. Nothing was regenerated: every word you just heard is the original audio, only cut."

ON SCREEN: Morph. The cut words drop out and the rest slide together; the waveform closes up to {d['fixed_duration']:.1f} s; the cleaned audio plays by itself with the playhead.
BUTTONS: "Before" and "After" play the two versions when clicked (handy in Q&A). Clicking anywhere else goes on.
SOURCE: respeak docs/RESULTS.md, End to end: "14.7 s test message cleaned to 8.0 s in 0.7 s (4 cuts)". This is that message. If you swap the recording, set clean_seconds in build/config.json to the new time (or null).
KNOWN: "the, the" stays: the cleanup did not mark that repeat.
{self.ph_note}
""")

    # ------------------------------------------------------------------ 6 Ctrl+F / X / V
    def s06_keys(self):
        sl = self.new()
        sl.kicker("The idea")
        sl.title("Speech in. Speech out.")
        keys = [("Ctrl+F", "Find", "Find the slip in your recording.", 2.8, INK),
                ("Ctrl+X", "Cut", "Cut out only that moment of audio.", 3.8, INK),
                ("Ctrl+V", "Voice", "Say the fix in your own voice, matched to the audio around it.", 5.6, MADE)]
        for n, (cap, word, desc, t, lit) in enumerate(keys):
            x = MX + n * 300
            sl.rect(x, 157, 248, 128, fill=PANEL, r=16)                      # keycap side (app sheet)
            sl.rect(x, 150, 248, 128, fill=GLASS, r=16, line=INK4, lw=0.75)  # keycap face (app glass)
            sl.text(x, 150, 248, 128, cap, size=34, font=SANS_SB, color=INK, align="c", anchor="m")
            on = sl.group([sl.rect(x, 150, 248, 128, fill=lit, r=16),
                           sl.text(x, 150, 248, 128, cap, size=34, font=SANS_SB, color=STAGE, align="c", anchor="m")])
            sl.anim(on, t, "fade", 0.25)
            sl.text(x, 306, 248, 36, word, size=28, font=SERIF_D)
            sl.text(x, 346, 240, 60, desc, size=15, color=INK2, line=1.1)
        sl.text(MX, 458, 848, 24, "Text is only used to find the edit. What you get back is audio.", size=17, font=SERIF_T,
                italic=True, color=INK2)
        sl.notes(f"""
{self.head(5)}
SAY:
"So think of it as three shortcuts for your voice. Find the slip. Cut it. And when a cut isn't enough: Voice. Say the fix, in your own voice."

ON SCREEN: Ctrl+F, Ctrl+X and Ctrl+V light up as you say Find (0:03), Cut (0:04) and Voice (0:06). Voice lights green: green means AI-made audio, as in the app.
""")

    # ------------------------------------------------------------------ 7 editor
    def s07_editor(self):
        sl = self.new()
        e = self.editor
        sl.kicker("Demo · the editor")
        sl.title("Change a word.\nKeep the voice.", size=32, w=280, h=84)
        new = self.rep["new"] if self.rep else "a new word"
        steps = [("Original or fixed, one click.", 1.3),
                 ("Select a word, type a new one.", 3.8),
                 ("Said in your voice, checked by re-transcribing.", e.get("green_at", 9.6))]
        for n, (label, t) in enumerate(steps, 1):
            y = 190 + (n - 1) * 62
            sl.step(MX, y, n, "", t + 0.1, 10, lit=MADE if n == 3 else INK)
            dim = sl.text(MX + 30, y + 1, 236, 44, label, size=14, color=INK3, line=1.05)
            on = sl.text(MX + 30, y + 1, 236, 44, label, size=14, color=INK, line=1.05)
            sl.anim(on, t + 0.1, "fade", 0.35)
        sl.text(MX, 420, 260, 40, "3.1–4.2 s", size=30, font=SANS_L)
        sl.text(MX, 460, 260, 18, "per replaced word, ASR-verified", size=12, color=INK3)
        sl.media(CLIPS / "editor.mp4", 344, 69, 560, 402.5, poster=CLIPS / "editor_first.png", play_at=0)
        sec = self.rep.get("sec") if self.rep else None
        sl.notes(f"""
{self.head(6)}
SAY:
"In the editor: original or fixed, one click. Select a word, type a new one." (while it works) "It's said in your voice, then re-transcribed to check." (let the phrase play) "Three to four seconds a word."

ON SCREEN: Original / Fixed (0:01-0:03), select "{self.rep['old'].rstrip('.,') if self.rep else ''}" (0:04), Replace, type "{new}"; the engine's result arrives after its real {sec or 3.5:.1f} s and "{new}" turns green (0:10); then the edited phrase plays from the engine's real audio.
SOURCE: the replacement and its audio are a real engine run on this message ({self.rep.get('engine') if self.rep else ''}, ASR-verified). RESULTS.md End to end: "'cafe' -> 'park' in 3.1-4.2 s, ASR-verified". The clip is the real app UI (its own HTML/JS) with engine calls answered from saved engine output.
{self.ph_note}
""")

    # ------------------------------------------------------------------ 8 tone
    def s08_tone(self):
        sl = self.new()
        sl.media(CLIPS / "tone.mp4", MX, 83, 520, 373.75, poster=CLIPS / "tone_first.png", play_at=0)
        x = 612
        sl.kicker("Demo · tone", x, 112)
        sl.title("Same words.\nDifferent tone.", y=130, size=32, x=x, w=292, h=84)
        rows = [("Confident", "lower and quicker", T_CONF, 2.0), ("Warm", "brighter and livelier", T_WARM, 3.9),
                ("Calm", "slower and steadier", T_CALM, 5.6)]
        for n, (name, blurb, col, t) in enumerate(rows):
            y = 246 + n * 34
            sl.oval(x, y + 6, 12, line=INK4, lw=1.2)
            sl.text(x + 22, y, 260, 24, name, size=15, color=INK3, anchor="m", runs=[(name, {})])
            on = sl.group([sl.oval(x, y + 6, 12, fill=col),
                           sl.text(x + 22, y, 270, 24, f"{name}  {blurb}", size=15, color=INK2, anchor="m",
                                   runs=[(name, {"color": INK, "font": SANS_SB})])])
            sl.anim(on, t + 0.2, "fade", 0.35)
        sl.text(x, 368, 292, 44, "Pitch and pace of your own recording. Your voice is untouched.", size=14, color=INK2, line=1.1)
        sl.text(x, 420, 292, 18, "about 0.1 s per preset", size=12, color=INK3)
        sl.notes(f"""
{self.head(7)}
SAY:
"Same words, different tone: confident, warm, calm. It only moves pitch and pace, so it's still your voice."

ON SCREEN: the tone panel of the real app; each character lights up as its slider rises (confident 0:02, warm 0:04, calm 0:06). No tone audio is played on this slide.
SOURCE: RESULTS.md Round 2, Tone: "Natural presets: 0.1 s, voice untouched (pitch/pace only)." The AI tone engine is a separate, experimental option and is not shown.
""")

    # ------------------------------------------------------------------ 9 real screen recording
    def s09_screen(self):
        sl = self.new()
        sl.kicker("Unedited screen recording", 72, 27)
        sl.text(588, 27, 300, 16, f"Ctrl+Voice in {self.cfg['send_target']}", size=11, color=INK3, align="r")
        screen = MEDIA / "screen.mp4"
        if screen.exists():
            sl.media(screen, 72, 58, 816, 459, play_at=0)
            todo = ""
        else:
            sl.rect(72, 58, 816, 459, fill=PANEL, r=18, line=INK3, lw=1.25, dash=4)
            tag_w = sl.measure("PLACEHOLDER", 10, SANS_SB, spacing=1.6) + 24
            sl.rect(480 - tag_w / 2, 196, tag_w, 24, fill=AMBER, r=12)
            sl.text(480 - tag_w / 2, 196, tag_w, 24, "PLACEHOLDER", size=10, font=SANS_SB, color=STAGE, align="c",
                    anchor="m", spacing=1.6)
            sl.text(122, 236, 716, 44, "Real screen recording goes here", size=30, font=SERIF_D, color=INK2, align="c")
            sl.text(172, 292, 616, 46, f"Ctrl+Voice in {self.cfg['send_target']} (Vesktop): press Alt+`, talk, say “scratch that”, "
                    "press Alt+` again, the message arrives. Then open it in the editor.", size=14, color=INK3, align="c", line=1.15)
            sl.text(172, 352, 616, 18, "Save it as media/screen.mp4 and rebuild (SWAP.md).", size=12, color=INK3, align="c")
            todo = ("PLACEHOLDER: there is no real screen recording in the deck yet. Record the real app in Discord/Vesktop "
                    "(Alt+`, talk, \"scratch that\", Alt+`, the message arrives; then open it in the editor), trim to about 14 s, "
                    "save as deck/media/screen.mp4 and rebuild (SWAP.md). Until then, hide this slide and give its time to How it works.\n")
        sl.notes(f"""
{self.head(8)}
{todo}SAY:
"And this is the real app, unedited: one key to record, one key to send, straight into {self.cfg['send_target']}."
""")

    # ------------------------------------------------------------------ 10 how it works
    def s10_how(self):
        sl = self.new()
        sl.kicker("How it works")
        sl.title("Three paths, one rule: cut first.", size=36)
        lanes = [
            ("Live", "while you talk", RED, 0.4, [
                ("Mic stream", "24 kHz audio to the engine"),
                ("Whisper large-v3-turbo", "re-transcribes about once a second"),
                ("Forced aligner", "wav2vec2 re-times every word"),
                ("Undo / “scratch that”", "an LLM picks where the thought began")]),
            ("Clean", "when you stop", INK, 6.5, [
                ("Qwen3.6-35B-A3B", "marks fillers, corrections, scratched thoughts"),
                ("Rule checks", "delete-only; numbers, dates, “not” protected"),
                ("Render", "cuts at the quietest point, 12 ms crossfades"),
                ("Send", "pasted into the chat you were in")]),
            ("Regenerate", "one word", MADE, 12.5, [
                ("Context", "about 4 s of your audio on each side"),
                ("PlayDiffusion ‖ F5-TTS", "two speech models in parallel"),
                ("Splice", "only the new word enters the original"),
                ("Verify", "re-transcribe, keep the closest voice")]),
        ]
        x0, nw, gap = 214, 157, 20
        for n, (name, sub, col, t, nodes) in enumerate(lanes):
            y = 136 + n * 118
            parts = [sl.oval(MX, y + 10, 10, fill=col),
                     sl.text(MX + 18, y + 3, 140, 22, name.upper(), size=11.5, font=SANS_SB, spacing=1.4),
                     sl.text(MX + 18, y + 25, 140, 18, sub, size=12, color=INK3)]
            for m, (a, b) in enumerate(nodes):
                x = x0 + m * (nw + gap)
                parts += [sl.rect(x, y - 8, nw, 92, fill=PANEL, r=10, line=col if (n == 2 and m == 2) else LINE),
                          sl.text(x + 12, y + 2, nw - 22, 74, f"{a}\n{b}", size=10.5, color=INK2, line=1.08,
                                  runs=[(a, {"color": INK, "font": SANS_SB, "size": 12.5})])]
                if m:
                    parts.append(sl.line(x - gap + 3, y + 38, x - 3, y + 38, color=INK4, w=1.25, arrow=True))
            sl.anim(sl.group(parts), t, "wipe", 0.8, direction=4)
        sl.notes(f"""
{self.head(9)}
SAY:
"Three paths. Live: Whisper re-transcribes the whole message about once a second and a forced aligner times each word, so 'scratch that' works mid-sentence. Clean: an LLM marks what to cut; rule checks only let it delete, and it can't drop a number, a date or a 'not' unless you corrected it. Regenerate: two speech models race, and we keep the take that passes re-transcription and sounds most like you."

ON SCREEN: the three lanes appear as you reach them (0:00, 0:06, 0:12). The green-outlined box (Splice) is the key idea of the next slide.
SOURCE: respeak docs/HANDOFF.md §2: the server re-transcribes every 0.7 s (the live test saw an update about every 0.9 s), wav2vec2 CTC forced aligner, Qwen3.6-35B-A3B with delete-only validators that protect negations/numbers/dates unless a correction replaces them with the same type, 12 ms equal-power crossfades at the quietest frame, PlayDiffusion and F5-TTS in parallel on a window of up to about 4 s each side, verified by re-transcription, best by speaker similarity (ECAPA). Ctrl+Voice README: the file is pasted into the window you were in.
""")

    # ------------------------------------------------------------------ 11 key insight
    def s11_insight(self):
        sl = self.new()
        sl.kicker("The key insight")
        sl.title("Regenerate one word, not the clip.")
        lv = self.levels[20:92]
        rows = [("Regenerate the whole clip", "every sample is AI audio", [MADE] * len(lv), "0.733", INK2, 0.8),
                ("Splice one word into the original", "the rest is your real recording",
                 [MADE if 33 <= k < 39 else INK2 for k in range(len(lv))], "0.976", INK, 4.6)]
        for n, (lab, sub, cols, num, ncol, t) in enumerate(rows):
            y = 166 + n * 128
            parts = [sl.text(MX, y + 14, 240, 24, lab, size=16, font=SANS_SB),
                     sl.text(MX, y + 40, 240, 20, sub, size=13, color=INK3)]
            parts += sl.bars(lv, 318, y + 40, 400, 62, None, bw=2.6, colors=cols, alpha=0.25 if n == 0 else 0)
            parts += [sl.text(744, y + 6, 160, 50, num, size=44, font=SANS_L, color=ncol),
                      sl.text(746, y + 58, 160, 18, "voice similarity", size=12, color=INK3)]
            sl.anim(sl.group(parts), t, "fade", 0.5)
        sl.text(MX, 450, 848, 34, "Similarity of the edited clip to the original voice. PlayDiffusion on 10 real recordings "
                "(LibriSpeech, AMI, DisfluencySpeech); same engine, same edits. Green = AI-generated audio.",
                size=11, color=INK3, line=1.1)
        sl.notes(f"""
{self.head(10)}
SAY:
"Here's what makes it work. Regenerate the whole clip and the voice drifts: 0.73 similarity. Regenerate only the new word and splice it into the untouched original: 0.98. Same engine, same edits."

SOURCE: respeak docs/RESULTS.md Round 1, word/phrase replacement, 10 real recordings: "PlayDiffusion raw (no splice)" voice sim 0.733; "PlayDiffusion + splice" 0.976 (both 10/10 vs 9/10 correct, WER 0.046).
""")

    # ------------------------------------------------------------------ 12 benchmarks
    def s12_bench(self):
        sl = self.new()
        sl.kicker("Benchmarks")
        sl.title("Measured on real speech.")
        cols = [(MX, 150, "Step"), (216, 360, "What we compared"), (604, 300, "Best result")]
        for x, w, h in cols:
            sl.kicker(h, x, 136, w=w)
        rows = [
            ("Clean up", "Qwen3-8B, Qwen3.6-35B-A3B, + a repair rule\n28 messages, 10 of them trick sentences",
             "24/28 exact", "0/10 wrong deletions (first try: 9/28, 2/10)"),
            ("Live undo", "Undo and “scratch that” while recording\n6 partial messages",
             "351 ms", "6/6 correct; 395 ms through the public proxy"),
            ("Replace a word", "dots.tts.edit, PlayDiffusion, F5-TTS, AuK-Flash\n10 real recordings",
             "9/10 correct", "PlayDiffusion + splice, 1.5 s per edit"),
            ("Mispronunciation", "training-free scores vs our trained detector\nspeechocean762, 15,967 words",
             "AUC 0.88", "training-free: 0.73"),
            ("Grammar", "fix said in the speaker’s own voice\n8 non-native speakers (EdAcc)",
             "8/8 rendered", "heard correctly; clips were pre-selected"),
        ]
        for n, (step, what, res, det) in enumerate(rows):
            y = 162 + n * 56
            parts = [sl.line(MX, y, 904, y, color=LINE, w=0.75),
                     sl.text(MX, y + 10, 150, 22, step, size=14.5, font=SANS_SB),
                     sl.text(216, y + 9, 370, 40, what, size=11.5, color=INK3, line=1.1,
                             runs=[(what.split("\n")[0], {"color": INK2})]),
                     sl.text(604, y + 7, 300, 26, res, size=18, font=SANS_SB, color=MADE if n < 3 else INK),
                     sl.text(604, y + 32, 300, 18, det, size=11, color=INK3)]
            sl.anim(sl.group(parts), 0.2 + 0.3 * n, "fade", 0.4)
        sl.line(MX, 442, 904, 442, color=LINE, w=0.75)
        sl.text(MX, 456, 848, 32, "All on one A100 80 GB. Small test sets: engineering measurements, not paper results. "
                "The grammar clips were pre-selected, so 8/8 measures rendering, not detection.", size=11, color=INK3, line=1.1)
        sl.notes(f"""
{self.head(11)}
SAY:
"We measured every stage on real speech. Cleanup: 24 of 28 messages exactly right, with zero wrong deletions on trick sentences. Undo in 351 milliseconds. Word replacement: 9 of 10 correct."

SOURCE: respeak docs/RESULTS.md. Clean up: Qwen3-8B word indices 9/28, 2/10 wrong deletions; Qwen3.6-35B-A3B inline markup 15/28, 0/10; + repair post-processor 24/28, 0/10; undo 4/6 -> 6/6. End to end: live undo 351 ms (395 ms through the public HTTPS proxy). Replacement: PlayDiffusion + splice 9/10, WER 0.046, voice sim 0.976, 1.5 s/edit (dots.tts.edit + splice was 10/10 but 12.7 s/edit). Detector: AUC 0.88 (acc <= 5) vs 0.73 training-free; correlation with experts 0.53 (published GOPT 0.53). Grammar: 8/8 rendered and heard correctly on EdAcc, 2.3-6.2 s each; utterances were pre-selected by the same prompt.
NOTE: from the desktop app over the pod proxy, undo round trips measured 375 ms in one live test and about 1.8 s in another. Quote 351 ms as the engine number.
""")

    # ------------------------------------------------------------------ 13 who it's for
    def s13_who(self):
        sl = self.new()
        sl.kicker("Who it’s for")
        sl.title("For anyone who’s ever hit re-record.", size=36)
        cols = [
            (0.3, [("44%", dict(size=58, font=SANS_L))],
             "of people play voice notes at double speed. Shorter, cleaner notes respect their time.",
             "Sky Mobile poll of 2,000 UK adults, 2025"),
            (4.0, None, "Second-language speakers: the grammar is fixed in their own voice.",
             "8/8 fixes rendered on non-native speakers"),
            (8.0, None, "Anyone mid-rant: take it back before it’s sent.", "live undo in 351 ms"),
        ]
        for n, (t, _, body, src) in enumerate(cols):
            x = MX + n * 300
            parts = []
            if n == 0:
                parts.append(sl.text(x, 160, 248, 70, "44%", size=58, font=SANS_L, anchor="m"))
            elif n == 1:
                gs = 24
                while sl.measure("“didn’t got” → “didn’t get”", gs, SERIF_T) > 270:
                    gs -= 0.5
                parts.append(sl.text(x, 160, 290, 70, "“didn’t got” → “didn’t get”", size=gs, font=SERIF_T, anchor="m", wrap=False,
                                     runs=[("got", {"color": INK3, "strike": True}), ("get", {"color": MADE})]))
            else:
                parts.append(sl.text(x, 160, 248, 70, "“…scratch that.”", size=24, font=SERIF_T, italic=True, anchor="m",
                                     runs=[("scratch that.", {"color": RED, "strike": True})]))
            parts += [sl.line(x, 246, x + 248, 246, color=LINE, w=0.75),
                      sl.text(x, 262, 248, 80, body, size=15.5, color=INK2, line=1.12),
                      sl.text(x, 356, 248, 32, src, size=11, color=INK3, line=1.1)]
            sl.anim(sl.group(parts), t, "fade", 0.5)
        sl.notes(f"""
{self.head(12)}
SAY:
"For listeners: 44% play voice notes at double speed. For second-language speakers: 'didn't got' becomes 'didn't get', in their own voice. And for anyone who'd like to take it back."

SOURCE: Sky Mobile poll of 2,000 UK adults (2025): 44% listen to voice notes at double speed; the average voice note is 3 minutes, people want 2. https://www.skygroup.sky/article/voice-no-brits-call-time-on-long-voice-notes
RESULTS.md Round 2, Grammar: 8/8 fixes rendered and heard correctly on 8 EdAcc non-native speakers ("didn't got" -> "didn't get"); utterances were pre-selected, so this measures rendering, not detection.
""")

    # ------------------------------------------------------------------ 14 close
    def s14_close(self):
        sl = self.new()
        mw = sl.measure("Ctrl+Voice", 40, SANS_SB)
        total = 46 + 16 + mw
        x0 = (W - total) / 2
        sl.logo(x0, 112, 46)
        sl.text(x0 + 62, 105, mw + 10, 60, "Ctrl+Voice", size=40, font=SANS_SB, anchor="m", wrap=False)
        tag = sl.text(MX, 190, 848, 70, self.cfg["tagline"], size=50, font=SERIF_D, align="c")
        sl.anim(tag, 0.3, "fade", 0.6)
        team = self.cfg["team"]
        cw = 848 / len(team)
        parts = [sl.line(MX + 60, 334, 904 - 60, 334, color=LINE, w=0.75)]
        for n, m in enumerate(team):
            x = MX + n * cw
            ph = m["name"].startswith("[")
            parts += [sl.text(x, 356, cw, 22, m["name"], size=16, font=SANS_SB, color=AMBER if ph else INK, align="c"),
                      sl.text(x + 6, 380, cw - 12, 34, m["role"], size=12, color=INK3, align="c", line=1.05)]
        sl.anim(sl.group(parts), 1.4, "fade", 0.6)
        sl.text(MX, 494, 848, 18, f"{self.cfg['event']}  ·  {self.cfg['track']}", size=12, color=INK3, align="c")
        missing = sum(1 for m in team if m["name"].startswith("["))
        sl.notes(f"""
{self.head(13)}
SAY:
"We're Ctrl+Voice. Say it messy. Send it clean. Thank you."
""" + (f"\nTO DO: {missing} team names are still [Name] (amber). Fill them in build/config.json -> team and rebuild.\n" if missing else ""))

    # ------------------------------------------------------------------ appendix (hidden)
    def s15_appendix(self):
        sl = self.new()
        sl.s.SlideShowTransition.Hidden = -1
        sl.kicker("Appendix · for questions")
        sl.title("What we haven’t solved yet", size=32)
        limits = [
            "Grammar: 8/8 measures rendering only; the clips were pre-selected. False corrections on native speech are unmeasured.",
            "Whisper drops some repeats and restarts, so very disfluent speech is only partly cleaned (the “the, the” in the demo stays).",
            "No blind listening test of the splice seams yet.",
            "AI tone changes the voice (similarity 0.72–0.86); the natural presets are not listener-tested.",
            "“Did you mean?” is experimental: a suggestion only, often wrong.",
            "Accent removal was dropped: no measurable change.",
            "Licences: F5-TTS weights are CC-BY-NC, PlayDiffusion’s repo is archived. Fine for a hackathon, not a product.",
        ]
        tb = sl.text(MX, 120, 400, 360, "\n".join(limits), size=12, color=INK2, line=1.1)
        tb.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 7
        sl.text(500, 124, 404, 18, "WORD REPLACEMENT · 10 REAL RECORDINGS", size=9.5, font=SANS_SB, color=INK3, spacing=1.2)
        table = [("Engine", "Correct", "WER", "Voice sim", "s/edit"),
                 ("dots.tts.edit + splice", "10/10", "0.045", "0.975", "12.7"),
                 ("PlayDiffusion + splice", "9/10", "0.046", "0.976", "1.5"),
                 ("F5-TTS + splice", "7/10", "0.053", "0.982", "1.0"),
                 ("AuK-Flash + splice", "7/10", "0.066", "0.987", "0.5"),
                 ("PlayDiffusion, no splice", "10/10", "0.046", "0.733", "1.5")]
        xs = [500, 668, 728, 788, 858]
        for r, row in enumerate(table):
            y = 148 + r * 26
            for c, val in enumerate(row):
                sl.text(xs[c], y, 160 if c == 0 else 56, 20, val, size=11.5 if r else 9.5,
                        font=SANS_SB if r == 0 or (r == 2 and c == 0) else SANS, color=INK if r == 2 else (INK3 if r == 0 else INK2))
            sl.line(500, y + 21, 904, y + 21, color=LINE, w=0.5)
        sl.text(500, 316, 404, 18, "MISPRONUNCIATION DETECTOR · SPEECHOCEAN762", size=9.5, font=SANS_SB, color=INK3, spacing=1.2)
        sl.text(500, 338, 404, 80, "Correlation with experts 0.53 (published GOPT 0.53, 3MH 0.68, Azure 0.62). "
                "AUC 0.88 for words experts rated ≤ 5, 0.91 for any mispronunciation; training-free 0.73 / 0.77.\n"
                "AI-made words are marked green for the listener; the original recording is never changed.",
                size=11.5, color=INK2, line=1.1)
        sl.notes("Hidden appendix slide (not shown in the slide show). Open it in Q&A if asked about limits or full numbers.\n"
                 "SOURCE: respeak docs/RESULTS.md and docs/HANDOFF.md §7 Known issues.")

    def build(self):
        for f in (self.s01_title, self.s02_problem, self.s03_demo, self.s04_before, self.s05_after, self.s06_keys,
                  self.s07_editor, self.s08_tone, self.s09_screen, self.s10_how, self.s11_insight, self.s12_bench,
                  self.s13_who, self.s14_close, self.s15_appendix):
            t = time.time()
            f()
            print(f"  slide {self.k:2d} {f.__name__[4:]:10s} {time.time() - t:5.1f} s")


# ======================================================================================= PowerPoint plumbing
def powerpoint():
    running = b"POWERPNT.EXE" in subprocess.run(["tasklist"], capture_output=True).stdout
    app = win32com.client.DispatchEx("PowerPoint.Application")
    app.DisplayAlerts = 1          # ppAlertsNone: fail instead of showing a dialog
    return app, running


def release(app, running):
    if not running and app.Presentations.Count == 0:
        app.Quit()


def setup_theme(pres):
    pres.PageSetup.SlideWidth, pres.PageSetup.SlideHeight = W, H
    m = pres.SlideMaster
    m.Background.Fill.Solid()
    m.Background.Fill.ForeColor.RGB = rgb(STAGE)
    th = m.Theme
    for idx, col in {1: INK, 2: STAGE, 3: INK2, 4: PANEL, 5: MADE, 6: AMBER, 7: RED, 8: INK2, 9: INK3, 10: "3D5A4F",
                     11: MADE, 12: INK2}.items():
        th.ThemeColorScheme.Colors(idx).RGB = rgb(col)
    th.ThemeFontScheme.MajorFont.Item(1).Name = SERIF_D
    th.ThemeFontScheme.MinorFont.Item(1).Name = SANS


MORPH = ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
         '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
         '<p:transition xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="slow" p14:dur="1600">'
         '<p159:morph option="byWord"/></p:transition></mc:Choice>'
         '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')


def inject_morph(src, dst, slide_no):
    with zipfile.ZipFile(src) as z:
        pres_xml = z.read("ppt/presentation.xml").decode("utf-8")
        rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
        rid = re.findall(r'<p:sldId [^>]*r:id="(rId\d+)"', pres_xml)[slide_no - 1]
        target = re.search(rf'Id="{rid}"[^>]*Target="([^"]+)"', rels) or re.search(rf'Target="([^"]+)"[^>]*Id="{rid}"', rels)
        part = "ppt/" + target.group(1).lstrip("/").replace("ppt/", "")
        xml = z.read(part).decode("utf-8")
        xml = re.sub(r"<mc:AlternateContent[^>]*>(?:(?!</mc:AlternateContent>).)*?<p:transition.*?</mc:AlternateContent>", "", xml, flags=re.S)
        xml = re.sub(r"<p:transition\b[^>]*/>|<p:transition\b.*?</p:transition>", "", xml, flags=re.S)
        anchor = "</p:clrMapOvr>" if "</p:clrMapOvr>" in xml else "</p:cSld>"
        xml = xml.replace(anchor, anchor + MORPH, 1)
        minidom.parseString(xml.encode("utf-8"))           # must stay well-formed
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as out:
            for it in z.infolist():
                data = xml.encode("utf-8") if it.filename == part else z.read(it.filename)
                out.writestr(it, data)
    return part


def check_package(path):
    with zipfile.ZipFile(path) as z:
        bad = z.testzip()
        assert bad is None, f"corrupt zip member {bad}"
        for n in z.namelist():
            if n.endswith(".xml") or n.endswith(".rels"):
                minidom.parseString(z.read(n))


def export_pngs(pres, folder):
    folder.mkdir(parents=True, exist_ok=True)
    for f in folder.glob("slide-*.png"):
        f.unlink()
    for i in range(1, pres.Slides.Count + 1):
        pres.Slides(i).Export(str(folder / f"slide-{i:02d}.png"), "PNG", 1920, 1080)


def make_video(app, path, out_mp4):
    pres = app.Presentations.Open(str(path), -1, 0, 0)
    try:
        for i, secs in enumerate(SLOTS, 1):
            t = pres.Slides(i).SlideShowTransition
            t.AdvanceOnTime = -1
            t.AdvanceTime = max(1, secs - t.Duration)
        pres.CreateVideo(str(out_mp4), True, 5, 720, 30, 85)
        t0 = time.time()
        while pres.CreateVideoStatus in (1, 2):
            time.sleep(2)
            if time.time() - t0 > 1800:
                raise SystemExit("CreateVideo timed out")
        print("  video status", pres.CreateVideoStatus, f"{time.time() - t0:.0f} s")
    finally:
        pres.Close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", action="store_true", help="also render render/deck_preview.mp4 (3:00, timed)")
    ap.add_argument("--out", default=str(FINAL))
    args = ap.parse_args()
    data = json.loads((MEDIA / "deck_data.json").read_text("utf-8"))
    cfg = json.loads((BUILD / "config.json").read_text("utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    raw, morphed, final = OUT / "deck_com.pptx", OUT / "deck_morph.pptx", Path(args.out)

    app, running = powerpoint()
    try:
        pres = app.Presentations.Add(0)
        try:
            setup_theme(pres)
            Builder(pres, data, cfg).build()
            pres.SaveAs(str(raw), 24)
        finally:
            pres.Close()
        part = inject_morph(raw, morphed, 5)
        print("morph injected into", part)
        check_package(morphed)
        pres = app.Presentations.Open(str(morphed), 0, 0, 0)
        try:
            ee = pres.Slides(5).SlideShowTransition.EntryEffect
            print("slide 5 transition EntryEffect", ee)
            assert ee not in (0, 3849), "Morph did not survive"
            n_media = sum(1 for i in range(1, pres.Slides.Count + 1) for s in pres.Slides(i).Shapes if s.Type == 16)
            print("slides", pres.Slides.Count, "media shapes", n_media)
            final.parent.mkdir(parents=True, exist_ok=True)
            pres.SaveAs(str(final), 24)
            export_pngs(pres, RENDER)
        finally:
            pres.Close()
        check_package(final)
        shutil.copy2(final, OUT / "deck_final.pptx")
        print(f"saved {final} ({final.stat().st_size / 1e6:.1f} MB); PNGs in {RENDER}")
        if args.video:
            make_video(app, final, RENDER / "deck_preview.mp4")
            print("preview video", RENDER / "deck_preview.mp4")
    finally:
        release(app, running)


if __name__ == "__main__":
    main()
