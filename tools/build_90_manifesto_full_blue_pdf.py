import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
SOURCE = WORKSPACE / "tmp" / "pdfs" / "the-90-manifesto-source.txt"
CH3_SOURCE = WORKSPACE / "tmp" / "pdfs" / "aos-ch3-source.txt"
AUTHOR_SOURCE = WORKSPACE / "tmp" / "pdfs" / "author-page-source.txt"
PHILOSOPHY_SOURCE = WORKSPACE / "tmp" / "pdfs" / "philosophy-tca-source.txt"
OUT_DIR = WORKSPACE / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = OUT_DIR / "The-90-Manifesto-Full-Edited-Blue.pdf"
COVER_IMAGE = ROOT / "public" / "plan-covers" / "90-percent-blueprint.jpg"
APP_ICON = ROOT / "public" / "app-icon.png"

PAGE_W, PAGE_H = letter

INK = colors.HexColor("#0B0D10")
NIGHT = colors.HexColor("#05070B")
NAVY = colors.HexColor("#0F172A")
FIELD = colors.HexColor("#111827")
PANEL = colors.white
SURFACE = colors.HexColor("#F4F6FB")
LINE = colors.Color(15 / 255, 23 / 255, 42 / 255, alpha=0.14)
MUTED = colors.HexColor("#687083")
BLUE = colors.HexColor("#2F6DF6")
BLUE_DARK = colors.HexColor("#1646C8")
BLUE_SOFT = colors.HexColor("#EAF0FF")
GREEN = colors.HexColor("#16A36B")
RED = colors.HexColor("#1F2937")
WHITE = colors.white


KEY_CALLOUTS = {
    "Athletic success is 90% mental and 10% physical.": ("THE 90% PHILOSOPHY", BLUE),
    "The body performs only as consistently as the mind allows.": ("REMEMBER THIS", FIELD),
    "Physical development opens the door.": ("THE SHIFT", BLUE_DARK),
    "Mental development determines how often an athlete walks through it.": ("THE SHIFT", BLUE_DARK),
    "The difference wasn't talent.": ("SEPARATION POINT", BLUE),
    "The difference wasn't coaching.": ("SEPARATION POINT", BLUE),
    "The difference was what happened after failure.": ("SEPARATION POINT", BLUE),
    "Every coach teaches mechanics.": ("THE GAP", FIELD),
    "Very few teach recovery.": ("THE GAP", FIELD),
    "Every coach teaches technique.": ("THE GAP", FIELD),
    "Very few teach identity.": ("THE GAP", FIELD),
    "Every coach teaches strategy.": ("THE GAP", FIELD),
    "Very few teach emotional control.": ("THE GAP", FIELD),
    "Every coach teaches the game.": ("THE GAP", FIELD),
    "Very few teach the athlete playing it.": ("THE GAP", FIELD),
    "The practice was identical.": ("IDENTITY SHIFT", BLUE),
    "The interpretation wasn't.": ("IDENTITY SHIFT", BLUE),
    "And interpretation quietly becomes identity.": ("IDENTITY SHIFT", BLUE),
    "One describes an event.": ("EVENT VS IDENTITY", BLUE_DARK),
    "The other describes a person.": ("EVENT VS IDENTITY", BLUE_DARK),
    "The event isn't the deciding factor.": ("PARADIGM", FIELD),
    "The paradigm is.": ("PARADIGM", FIELD),
    "The paradigm determines what the event means.": ("MEMORIZE THIS", BLUE),
    "Events don't become beliefs.": ("BELIEF BUILDER", BLUE),
    "Meaning becomes belief.": ("BELIEF BUILDER", BLUE),
    "The atmosphere outside becomes the voice inside.": ("HOME CULTURE", BLUE),
    "Pressure is simply a mirror reflecting what repetition has already built.": ("PRESSURE REVEALS", BLUE_DARK),
    "Mechanics may win moments.": ("LAW OF REPETITION", FIELD),
    "Identity wins careers.": ("LAW OF REPETITION", FIELD),
    "The scoreboard reveals.": ("FRAMEWORK TRUTH", BLUE),
    "It doesn't create.": ("FRAMEWORK TRUTH", BLUE),
    "Mental performance isn't an event.": ("DAILY PRACTICE", BLUE_DARK),
    "It's a daily practice.": ("DAILY PRACTICE", BLUE_DARK),
    "Every athlete has an Athletic Operating System.": ("ATHLETIC OPERATING SYSTEM", BLUE),
    "The operating system does.": ("AOS TRUTH", FIELD),
    "The operating systems were not.": ("AOS TRUTH", FIELD),
    "And meaning changes everything.": ("MEANING CHANGES EVERYTHING", BLUE),
    "Athletes don't respond to reality.": ("INTERPRETATION", BLUE_DARK),
    "They respond to their interpretation of reality.": ("INTERPRETATION", BLUE_DARK),
    "And interpretation is the job of the operating system.": ("INTERPRETATION", BLUE_DARK),
    "The subconscious mind.": ("THE OPERATING SYSTEM", FIELD),
    "Bob Proctor called it a paradigm.": ("THE OPERATING SYSTEM", FIELD),
    "The operating system doesn't only automate movements.": ("AUTOMATION", BLUE),
    "It automates beliefs.": ("AUTOMATION", BLUE),
    "It automates expectations.": ("AUTOMATION", BLUE),
    "It automates emotional responses.": ("AUTOMATION", BLUE),
    "It automates identity.": ("AUTOMATION", BLUE),
    "Pressure doesn't create new behavior.": ("PRESSURE REVEALS", BLUE_DARK),
    "It reveals the operating system that has been trained the deepest.": ("PRESSURE REVEALS", BLUE_DARK),
    "Performance isn't where transformation begins.": ("TRANSFORMATION", FIELD),
    "It's where transformation becomes visible.": ("TRANSFORMATION", FIELD),
    "Because operating systems can be upgraded.": ("HOPE", BLUE),
    "Your child is not broken.": ("HOPE", BLUE),
    "Behavior is usually the report card.": ("REPORT CARD", BLUE_DARK),
    "The operating system is where the real work begins.": ("REPORT CARD", BLUE_DARK),
}

SECTION_HEADINGS = {
    "Reflection",
    "Closing",
    "The First Architect",
    "The Second Architect",
    "The Third Architect",
    "The Fourth Architect",
    "Environment",
    "Association",
    "Information",
    "Experience",
    "Inputs",
    "Beliefs",
    "Paradigm",
    "Identity",
    "Habits",
    "Performance",
}

TIGHTEN_SKIP_LINES = {
    "Have you ever noticed something strange?",
    "That isn't criticism of coaches.",
    "Of course not.",
    "It absolutely does.",
    "Here's the question I want you to carry into the next chapter:",
    "Whether you've heard that story before isn't what matters.",
    "What matters is the principle.",
    "Notice the difference.",
    "That single shift changes everything.",
    "Here's something fascinating about the human mind.",
    "The scary part isn't that those thoughts appear.",
    "Think about that.",
    "Now consider what happens after a mistake.",
    "This realization changed the way I viewed athletic development forever.",
    "Those are completely different questions.",
    "Which brings us back to the question every athlete is silently answering.",
    "More importantly...",
    "That is where everything changes.",
    "Most people have heard those words.",
    "Very few understand what they actually mean.",
    "But here's what's fascinating.",
    "How?",
    "Here's where everything changes.",
    "This is why trying harder often doesn't work.",
    "Imagine opening a GPS.",
    "Now think back over everything we've discussed.",
    "None of those were separate ideas.",
    "The purpose is much deeper.",
    "Not overnight.",
    "But inevitably.",
    "Stand in front of a beautiful home.",
    "Very few people stop to think about what made the house possible.",
    "Belief works the same way.",
    "That's important.",
    "But here's a deeper question.",
    "The opposite is also true.",
    "Think about nutrition for a moment.",
    "Remember what we learned in the last chapter.",
    "Sometimes the better question is...",
    "Step back and look at the entire picture.",
    "Pause for a moment.",
    "Those things may help.",
    "And the beautiful truth is this:",
    "Walk into any batting cage.",
    "Walk into any weight room.",
    "Athletes understand something instinctively.",
    "The answer is exactly the same.",
    "Think about learning to tie your shoes.",
    "The goal wasn't simply to learn.",
    "The goal was to automate.",
    "This explains something many parents have experienced.",
    "That's normal.",
    "Remember the first time your athlete learned a proper swing?",
    "The same is true mentally.",
    "Suddenly, ordinary days begin to look different.",
    "This is why transformation is rarely dramatic.",
    "Close your eyes for just a moment.",
    "If you're like most people...",
    "That may seem like a simple exercise.",
    "It isn't.",
    "Let's step back for a moment.",
    "Not because life is simple.",
    "Let's walk through it together.",
    "Finally...",
    "Now read the framework from the bottom up.",
    "Suddenly...",
    "This is where hope enters the story.",
    "Ask yourself one question today.",
    "Let's step back one final time.",
    "Maybe the biggest perspective shift in this entire manifesto is this:",
    "And that's where the idea of The Complete Athlete was born.",
    "Not from a desire to create another sports app.",
    "The world already has enough apps.",
    "That's why The Complete Athlete isn't meant to replace great coaches.",
    "Those things remain incredibly valuable.",
    "The investment is worth making.",
    "And in the end...",
    "That's what this has always been about.",
}

TIGHTEN_SKIP_LINES.update({
    "And if they struggle?",
    "So that's what we do.",
    "But what if we've been asking the wrong question?",
    "What if it's found in the six inches between their ears?",
    "Think about the greatest athletes you've ever watched.",
    "But as athletes grow, everyone gets stronger.",
    "Why?",
    "Here's the part that most people never consider.",
    "But who is teaching your athlete what to do when confidence disappears?",
    "Who is teaching them how to respond after failure?",
    "Who is teaching them how to silence negative self-talk?",
    "Who is teaching them how to handle pressure?",
    "Who is teaching them how to build discipline when motivation fades?",
    "This is why we've built an entire youth sports culture around improving performance...",
    "Would you expect the upgrades alone to produce championships?",
    "Because the mind influences everything the body does.",
    "If your athlete stopped taking private lessons tomorrow, you would notice.",
    "But if they never learned confidence...",
    "Would you notice before it was too late?",
    "And they're the skills we're going to begin building together.",
    "And there's nothing wrong with that.",
    "A faster glove.",
    "But there's one piece of equipment every athlete brings into every game that almost nobody trains.",
    "Because you can't buy it off a shelf.",
    "And leave becoming two completely different people.",
    "That difference may seem small.",
    "And started asking...",
    "Because every practice is doing far more than improving mechanics.",
    "This is why the greatest athletes don't simply train their bodies.",
    "Because when pressure arrives...",
    "Because eventually...",
    "And that leads us to perhaps the most important discovery in this entire manifesto.",
    "Because if identity shapes behavior...",
    "Where does identity come from?",
    "Who teaches an athlete who they are?",
    "And if it has been built unintentionally...",
    "Can it be rebuilt intentionally?",
    "If performance comes from the person...",
    "Where does that person come from?",
    "Yet become completely different competitors?",
    "And it usually isn't found in coaching alone.",
    "Most simply don't realize they're running one.",
    "Think about your smartphone for a moment.",
    "But none of those apps determine how the phone fundamentally behaves.",
    "Most people never think about it.",
    "But underneath every swing...",
    "That may be one of the most important sentences in this entire book.",
    "Think of your conscious mind as the architect.",
    "But wanting something...",
    "And consistently becoming it...",
    "Only to realize you don't remember the last several miles?",
    "Because your operating system had already taken over.",
    "But here's what almost nobody teaches.",
    "And the automatic begins looking like personality.",
    "This explains something parents witness all the time.",
    "What happened?",
    "Now think back to everything we've talked about so far.",
    "So before asking,",
    "Because behavior is rarely the problem.",
    "Think about your athlete.",
    "When pressure appears...",
    "What operating system takes over?",
    "When they hear correction...",
    "What meaning does their mind automatically assign to it?",
    "When they make a mistake...",
    "What story immediately begins playing?",
    "Because whatever happens automatically...",
    "And whatever has been practiced repeatedly...",
    "But now you've discovered something deeper.",
    "If every athlete is already running an operating system...",
    "Who-or what-is programming it?",
    "Because no operating system writes itself.",
    "When you watch an athlete confidently step into a pressure-filled moment...",
    "When an athlete crumbles after one mistake...",
    "Most athletes never stop to ask...",
    "Because the truth is...",
    "This one may be the most powerful.",
    "Because it's the most consistent.",
    "Think about your athlete for a moment.",
    "And every home has a culture.",
    "Think about the ride home after a game.",
    "But internally...",
    "Because some of the deepest beliefs your athlete will ever carry...",
    "Who is teaching your athlete what \"normal\" looks like?",
    "Because normal eventually becomes identity.",
    "Think about nutrition for a moment.",
    "Because we understand something simple.",
    "Because before you change beliefs...",
    "But here's what we've discovered throughout this manifesto.",
    "Most athletes never notice the construction.",
    "If belief is being constructed every single day...",
    "Who are the builders in your athlete's life right now?",
    "What kind of culture exists inside your home?",
    "What kind of conversations surround your dinner table?",
    "Who has your child's ear when you're not around?",
    "What information are they consuming before they go to bed?",
    "How are they interpreting their failures?",
    "A better trainer?",
    "More lessons?",
    "Another travel team?",
    "Because athletes don't compete from talent alone.",
    "If beliefs can be built...",
    "That is where lasting transformation begins.",
    "If you want to own a skill...",
    "But here's the question almost nobody asks.",
    "If repetition builds mechanics... what builds the athlete?",
    "If the answer is yes...",
    "Now?",
    "What performance is it preparing for?",
    "Then suddenly look like a completely different person in competition?",
    "That principle doesn't only apply to physical preparation.",
    "This is why language matters so much.",
    "Now imagine the opposite.",
    "Maybe even uncomfortable.",
    "Because it was new.",
    "This is why I believe the greatest coaches aren't simply teaching athletes what to do.",
    "But thousands of times.",
    "And repetition is how paradigms change.",
    "Most people expect one speech.",
    "And starts believing.",
    "Without realizing it?",
    "And once the subconscious accepts a new identity...",
    "What is it practicing your athlete for?",
    "Now pick up one slice.",
    "Because the brain treats vividly imagined experiences differently than most people realize.",
    "Now consider the opposite.",
    "But they're rehearsing too.",
    "And whatever is remembered...",
    "This is why we've spent so much time talking about beliefs.",
    "But because understanding creates freedom.",
    "This collection of beliefs becomes what Bob Proctor called a paradigm.",
    "Most people begin here.",
    "Because performance is simply the visible expression of everything that came before it.",
    "When often...",
    "Because if performance is the result...",
    "If paradigms can be programmed...",
    "If identity has been formed...",
    "But with their mind.",
    "But always...",
    "Because the athlete who learns to rehearse courage...",
    "And possibility...",
    "If you've read every chapter of this manifesto...",
    "When we began...",
    "But now you've seen something deeper.",
    "And that realization changes everything.",
    "That paradigm shapes identity.",
    "But lasting transformation almost always begins at the top.",
    "And when behavior changes consistently...",
    "But because the mind influences everything the body expresses.",
    "So why would we expect one conversation to build an unshakable mindset?",
    "What if young athletes had a place that trained the invisible side of performance every single day?",
    "Because if we've learned anything together...",
    "And identity quietly shapes everything else.",
    "But because they're growing in every area that competition demands.",
    "Because confidence doesn't only help someone in sports.",
    "If this manifesto has resonated with you...",
    "And if you'd like a daily framework to help you do that...",
    "Because reading about mental performance can change awareness.",
    "So don't spend these years only building a better player.",
    "Because when you do that...",
})

TIGHTEN_SKIP_LINES.difference_update({
    "But what if we've been asking the wrong question?",
    "What if it's found in the six inches between their ears?",
    "But who is teaching your athlete what to do when confidence disappears?",
    "Who is teaching them how to respond after failure?",
    "Who is teaching them how to silence negative self-talk?",
    "Who is teaching them how to handle pressure?",
    "Who is teaching them how to build discipline when motivation fades?",
    "Because the mind influences everything the body does.",
    "If your athlete stopped taking private lessons tomorrow, you would notice.",
    "But if they never learned confidence...",
    "Would you notice before it was too late?",
    "But there's one piece of equipment every athlete brings into every game that almost nobody trains.",
    "That difference may seem small.",
    "Because every practice is doing far more than improving mechanics.",
    "This is why the greatest athletes don't simply train their bodies.",
    "Because if identity shapes behavior...",
    "Where does identity come from?",
    "Who teaches an athlete who they are?",
    "And if it has been built unintentionally...",
    "Can it be rebuilt intentionally?",
    "If performance comes from the person...",
    "Where does that person come from?",
    "Most simply don't realize they're running one.",
    "Think about your smartphone for a moment.",
    "But underneath every swing...",
    "Think of your conscious mind as the architect.",
    "But wanting something...",
    "And consistently becoming it...",
    "Because your operating system had already taken over.",
    "But here's what almost nobody teaches.",
    "This explains something parents witness all the time.",
    "Because behavior is rarely the problem.",
    "Think about your athlete.",
    "When pressure appears...",
    "What operating system takes over?",
    "When they hear correction...",
    "What meaning does their mind automatically assign to it?",
    "When they make a mistake...",
    "What story immediately begins playing?",
    "Because whatever happens automatically...",
    "If every athlete is already running an operating system...",
    "Who-or what-is programming it?",
    "Because no operating system writes itself.",
    "When you watch an athlete confidently step into a pressure-filled moment...",
    "When an athlete crumbles after one mistake...",
    "Because it's the most consistent.",
    "And every home has a culture.",
    "Think about the ride home after a game.",
    "Because some of the deepest beliefs your athlete will ever carry...",
    "Who is teaching your athlete what \"normal\" looks like?",
    "Because normal eventually becomes identity.",
    "Because we understand something simple.",
    "Because before you change beliefs...",
    "But here's what we've discovered throughout this manifesto.",
    "If belief is being constructed every single day...",
    "Who are the builders in your athlete's life right now?",
    "What kind of culture exists inside your home?",
    "What kind of conversations surround your dinner table?",
    "Who has your child's ear when you're not around?",
    "What information are they consuming before they go to bed?",
    "How are they interpreting their failures?",
    "Because athletes don't compete from talent alone.",
    "If beliefs can be built...",
    "That is where lasting transformation begins.",
    "If repetition builds mechanics... what builds the athlete?",
    "That principle doesn't only apply to physical preparation.",
    "This is why language matters so much.",
    "This is why I believe the greatest coaches aren't simply teaching athletes what to do.",
    "And repetition is how paradigms change.",
    "Because the brain treats vividly imagined experiences differently than most people realize.",
    "This is why we've spent so much time talking about beliefs.",
    "Because performance is simply the visible expression of everything that came before it.",
    "Because if performance is the result...",
    "If paradigms can be programmed...",
    "If identity has been formed...",
    "Because if we've learned anything together...",
    "And identity quietly shapes everything else.",
    "Because reading about mental performance can change awareness.",
})


def register_fonts():
    font_dir = Path("/System/Library/Fonts/Supplemental")
    fonts = {
        "TCACondensed": font_dir / "DIN Condensed Bold.ttf",
        "TCABody": font_dir / "Arial.ttf",
        "TCABodyBold": font_dir / "Arial Bold.ttf",
        "TCABodyItalic": font_dir / "Arial Italic.ttf",
        "TCASerif": font_dir / "Georgia.ttf",
        "TCASerifItalic": font_dir / "Georgia Italic.ttf",
    }
    for name, path in fonts.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))


def clean_text(text):
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u201c": '"',
        "\u201d": '"',
        "\u2018": "'",
        "\u2019": "'",
        "\u2026": "...",
        "\u2192": " to ",
        "\u00a0": " ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_page_marker(line):
    return bool(re.match(r"--- PAGE \d+ ---", line))


def is_chapter_line(line):
    return bool(re.match(r"^(CHAPTER (ONE|2|3|4|5|6)|Chapter 3|FINAL CHAPTER)$", line))


def is_title_candidate(line):
    return line and not is_chapter_line(line) and line not in SECTION_HEADINGS and not line.startswith('"')


def should_merge(current, nxt):
    if not current or not nxt:
        return False
    if is_chapter_line(current):
        return False
    if current in {"About the Author", "The Complete Athlete Philosophy"}:
        return False
    if current == "The Complete Athlete Framework":
        return False
    if current.startswith("Inputs to Beliefs to Paradigm to Identity to Habits to Performance"):
        return False
    if is_chapter_line(nxt) or nxt in SECTION_HEADINGS or is_page_marker(nxt):
        return False
    if nxt.startswith('"'):
        return False
    if re.match(r"^\d+\.", nxt):
        return False
    if current.endswith(("...", ".", "?", "!", '"', ":")):
        return False
    if current in SECTION_HEADINGS:
        return False
    if nxt.startswith(("And ", "But ", "Because ", "Or...", "Not ", "The ", "This ", "That ")):
        return False
    return True


def source_lines_with_new_chapter_three():
    original = SOURCE.read_text(encoding="utf-8").splitlines()
    replacement = CH3_SOURCE.read_text(encoding="utf-8").splitlines()

    start = next(i for i, line in enumerate(original) if clean_text(line) == "Chapter 3")
    end = next(i for i in range(start + 1, len(original)) if clean_text(original[i]) == "CHAPTER 4")
    return original[:start] + replacement + original[end:]


def parse_blocks():
    raw_lines = source_lines_with_new_chapter_three()
    lines = []
    for raw in raw_lines:
        line = clean_text(raw)
        if not line or is_page_marker(line):
            continue
        lines.append(line)

    merged = []
    i = 0
    while i < len(lines):
        line = lines[i]
        while i + 1 < len(lines) and should_merge(line, lines[i + 1]):
            line = f"{line} {lines[i + 1]}"
            i += 1
        merged.append(line)
        i += 1

    blocks = []
    i = 0
    while i < len(merged):
        line = merged[i]
        if is_chapter_line(line):
            title = merged[i + 1] if i + 1 < len(merged) else ""
            quote = ""
            jump = 2
            if i + 2 < len(merged) and merged[i + 2].startswith('"'):
                quote = merged[i + 2]
                jump = 3
            blocks.append(("chapter", line, title, quote))
            i += jump
            continue
        if line == "The Complete Athlete Framework":
            blocks.append(("framework_title", line))
            blocks.append(("framework_graphic", ""))
            i += 1
            continue
        if line in SECTION_HEADINGS:
            blocks.append(("section", line))
            i += 1
            continue
        if line.startswith('"') and line.endswith('"') and len(line) > 20:
            blocks.append(("quote", line.strip('"')))
            i += 1
            continue
        if line in KEY_CALLOUTS:
            title, bg = KEY_CALLOUTS[line]
            group = [line]
            while i + 1 < len(merged) and merged[i + 1] in KEY_CALLOUTS and KEY_CALLOUTS[merged[i + 1]][0] == title:
                group.append(merged[i + 1])
                i += 1
            blocks.append(("callout", title, "<br/>".join(group), bg))
            i += 1
            continue
        if re.match(r"^\d+\.", line):
            blocks.append(("question", line))
            i += 1
            continue
        if len(line) <= 32 and line.endswith(".") and not re.search(r"\s", line[:-1]):
            blocks.append(("emphasis", line))
            i += 1
            continue
        blocks.append(("p", line))
        i += 1
    return [block for block in blocks if not (block[0] in ("p", "emphasis") and block[1] in TIGHTEN_SKIP_LINES)]


def parse_front_matter_blocks(path):
    raw_lines = path.read_text(encoding="utf-8").splitlines()
    lines = []
    for raw in raw_lines:
        line = clean_text(raw)
        if not line or is_page_marker(line):
            continue
        lines.append(line)

    merged = []
    i = 0
    while i < len(lines):
        line = lines[i]
        while i + 1 < len(lines) and should_merge(line, lines[i + 1]):
            line = f"{line} {lines[i + 1]}"
            i += 1
        merged.append(line)
        i += 1
    return merged


def parse_author_blocks():
    return parse_front_matter_blocks(AUTHOR_SOURCE)


def parse_philosophy_blocks():
    return parse_front_matter_blocks(PHILOSOPHY_SOURCE)


class TopRule(Flowable):
    def __init__(self, width=1.0, color=BLUE, height=4):
        super().__init__()
        self.ratio = width
        self.color = color
        self.height = height

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, self.height + 9

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 2, self.width * self.ratio, self.height, 2, fill=1, stroke=0)


class AnswerLines(Flowable):
    def __init__(self, lines=2):
        self.lines = lines
        self.height = 16 * lines + 8
        super().__init__()

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, self.height

    def draw(self):
        self.canv.setStrokeColor(colors.Color(47 / 255, 109 / 255, 246 / 255, alpha=0.18))
        self.canv.setLineWidth(0.8)
        y = self.height - 10
        for _ in range(self.lines):
            self.canv.line(8, y, self.width - 8, y)
            y -= 16


class ReflectionBand(Flowable):
    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        self.height = 58
        return availWidth, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(BLUE_DARK)
        c.roundRect(0, 4, self.width, 48, 7, fill=1, stroke=0)
        c.setFillColor(colors.Color(255 / 255, 255 / 255, 255 / 255, alpha=0.12))
        c.rect(0, 4, self.width * 0.23, 48, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("TCABodyBold", 9)
        c.drawString(14, 31, "REFLECTION")
        c.setFont("TCABodyBold", 11.5)
        c.drawString(self.width * 0.23 + 16, 30, "Pause here. Write before you turn the page.")


def reflection_question(text, style):
    table = Table(
        [[para(text, style["question"])], [""]],
        colWidths=[5.75 * inch],
        rowHeights=[None, 0.46 * inch],
        hAlign="CENTER",
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, colors.Color(47 / 255, 109 / 255, 246 / 255, alpha=0.22)),
        ("LINEBEFORE", (0, 0), (0, -1), 4, BLUE),
        ("LINEBELOW", (0, 1), (0, 1), 0.8, colors.Color(47 / 255, 109 / 255, 246 / 255, alpha=0.28)),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (0, 0), 10),
        ("BOTTOMPADDING", (0, 0), (0, 0), 8),
        ("TOPPADDING", (0, 1), (0, 1), 6),
        ("BOTTOMPADDING", (0, 1), (0, 1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return KeepTogether([table, Spacer(1, 5)])


class FrameworkFlowable(Flowable):
    labels = ["INPUTS", "BELIEFS", "PARADIGM", "IDENTITY", "HABITS", "PERFORMANCE"]

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        self.height = 240
        return availWidth, self.height

    def draw(self):
        c = self.canv
        x = 0.35 * inch
        box_w = self.width - 0.7 * inch
        box_h = 28
        gap = 11
        y = self.height - box_h - 4
        fills = [FIELD, BLUE_DARK, BLUE, NAVY, RED, FIELD]
        for i, label in enumerate(self.labels):
            yy = y - i * (box_h + gap)
            c.setFillColor(fills[i])
            c.roundRect(x, yy, box_w, box_h, 6, fill=1, stroke=0)
            c.setFillColor(WHITE if label != "PARADIGM" else WHITE)
            c.setFont("TCABodyBold", 10)
            c.drawCentredString(x + box_w / 2, yy + 10, label)
            if i < len(self.labels) - 1:
                mid = x + box_w / 2
                c.setStrokeColor(colors.Color(47 / 255, 109 / 255, 246 / 255, alpha=0.42))
                c.setLineWidth(1.1)
                c.line(mid, yy - 2, mid, yy - gap + 5)


def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle("cover_kicker", parent=base["Normal"], fontName="TCABodyBold", fontSize=8.5, leading=10, textColor=BLUE, spaceAfter=8),
        "cover_title": ParagraphStyle("cover_title", parent=base["Title"], fontName="TCACondensed", fontSize=58, leading=51, textColor=WHITE, spaceAfter=8),
        "cover_sub": ParagraphStyle("cover_sub", parent=base["Normal"], fontName="TCASerif", fontSize=14.5, leading=20, textColor=colors.HexColor("#E8EEF9"), spaceAfter=16),
        "chapter_num": ParagraphStyle("chapter_num", parent=base["Normal"], fontName="TCABodyBold", fontSize=8.5, leading=10, textColor=BLUE, spaceAfter=6),
        "chapter_title": ParagraphStyle("chapter_title", parent=base["Heading1"], fontName="TCACondensed", fontSize=36, leading=34, textColor=INK, spaceAfter=9),
        "cta_title": ParagraphStyle("cta_title", parent=base["Heading1"], fontName="TCACondensed", fontSize=42, leading=39, textColor=INK, alignment=TA_CENTER, spaceAfter=10),
        "cta_body": ParagraphStyle("cta_body", parent=base["BodyText"], fontName="TCASerif", fontSize=13.3, leading=19, textColor=INK, alignment=TA_CENTER, spaceBefore=1, spaceAfter=8),
        "cta_button": ParagraphStyle("cta_button", parent=base["Normal"], fontName="TCABodyBold", fontSize=13, leading=16, textColor=WHITE, alignment=TA_CENTER),
        "section": ParagraphStyle("section", parent=base["Heading2"], fontName="TCABodyBold", fontSize=13.5, leading=16, textColor=FIELD, alignment=TA_CENTER, spaceBefore=8, spaceAfter=6),
        "section_blue": ParagraphStyle("section_blue", parent=base["Heading2"], fontName="TCABodyBold", fontSize=12.5, leading=15, textColor=BLUE_DARK, alignment=TA_CENTER, spaceBefore=8, spaceAfter=6),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="TCASerif", fontSize=12.0, leading=16.4, textColor=INK, alignment=TA_CENTER, spaceBefore=0, spaceAfter=4.8),
        "breath": ParagraphStyle("breath", parent=base["BodyText"], fontName="TCASerif", fontSize=12.0, leading=16.4, textColor=INK, alignment=TA_CENTER, spaceBefore=0, spaceAfter=4.8),
        "emphasis": ParagraphStyle("emphasis", parent=base["BodyText"], fontName="TCABodyBold", fontSize=11.8, leading=15, textColor=BLUE_DARK, alignment=TA_CENTER, spaceBefore=3, spaceAfter=5),
        "quote": ParagraphStyle("quote", parent=base["BodyText"], fontName="TCASerifItalic", fontSize=14, leading=19, textColor=INK, alignment=TA_CENTER),
        "callout_title": ParagraphStyle("callout_title", parent=base["Normal"], fontName="TCABodyBold", fontSize=8.4, leading=10, textColor=colors.HexColor("#BFD0FF"), alignment=TA_CENTER, spaceAfter=5),
        "callout_body": ParagraphStyle("callout_body", parent=base["Normal"], fontName="TCABodyBold", fontSize=12.4, leading=15.8, textColor=WHITE, alignment=TA_CENTER),
        "question": ParagraphStyle("question", parent=base["Normal"], fontName="TCABodyBold", fontSize=10.2, leading=14.5, textColor=INK, alignment=TA_LEFT, spaceAfter=4),
        "small": ParagraphStyle("small", parent=base["Normal"], fontName="TCABody", fontSize=8, leading=10, textColor=MUTED),
        "toc": ParagraphStyle("toc", parent=base["Normal"], fontName="TCABodyBold", fontSize=11.5, leading=16, textColor=INK, spaceAfter=4),
    }


def para(text, style):
    return Paragraph(clean_text(text), style)


def quote_card(text, style):
    table = Table([[para(text, style["quote"])]], colWidths=[5.45 * inch], hAlign="CENTER")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, colors.Color(47 / 255, 109 / 255, 246 / 255, alpha=0.22)),
        ("LINEABOVE", (0, 0), (-1, 0), 5, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("TOPPADDING", (0, 0), (-1, -1), 15),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 15),
    ]))
    return KeepTogether([Spacer(1, 5), table, Spacer(1, 8)])


def callout(title, text, bg, style):
    table = Table(
        [[para(title, style["callout_title"])], [para(text, style["callout_body"])]],
        colWidths=[4.95 * inch],
        hAlign="CENTER",
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEABOVE", (0, 0), (-1, 0), 4, BLUE_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 13),
        ("RIGHTPADDING", (0, 0), (-1, -1), 13),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return KeepTogether([Spacer(1, 5), table, Spacer(1, 8)])


def draw_gradient(canvas, y0=0, y1=PAGE_H, start=NIGHT, end=NAVY, steps=90):
    for i in range(steps):
        t = i / max(steps - 1, 1)
        r = start.red * (1 - t) + end.red * t
        g = start.green * (1 - t) + end.green * t
        b = start.blue * (1 - t) + end.blue * t
        canvas.setFillColor(colors.Color(r, g, b))
        y = y0 + (y1 - y0) * i / steps
        canvas.rect(0, y, PAGE_W, (y1 - y0) / steps + 1, fill=1, stroke=0)


def page_decor(canvas, doc):
    canvas.saveState()
    page = doc.page
    if page == 1:
        draw_gradient(canvas, start=NIGHT, end=NAVY)
        canvas.setFillColor(colors.Color(47 / 255, 109 / 255, 246 / 255, alpha=0.08))
        for x in range(0, int(PAGE_W), 46):
            canvas.rect(x, 0, 0.5, PAGE_H, fill=1, stroke=0)
        for y in range(0, int(PAGE_H), 46):
            canvas.rect(0, y, PAGE_W, 0.5, fill=1, stroke=0)
    else:
        canvas.setFillColor(SURFACE)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        draw_gradient(canvas, y0=PAGE_H - 0.34 * inch, y1=PAGE_H, start=NIGHT, end=NAVY, steps=18)
        canvas.setFillColor(BLUE)
        canvas.rect(0, PAGE_H - 0.34 * inch, 1.05 * inch, 0.34 * inch, fill=1, stroke=0)
        canvas.setFont("TCABody", 7.4)
        canvas.setFillColor(MUTED)
        canvas.drawString(0.58 * inch, 0.34 * inch, "The 90% Manifesto")
        canvas.drawRightString(PAGE_W - 0.58 * inch, 0.34 * inch, str(page))
    canvas.restoreState()


def build_cover(story, style):
    story.append(Spacer(1, 0.26 * inch))
    if COVER_IMAGE.exists():
        img = Image(str(COVER_IMAGE), width=6.9 * inch, height=3.88 * inch)
        img.hAlign = "CENTER"
        story.append(img)
        story.append(Spacer(1, 0.28 * inch))
    story.append(para("THE COMPLETE ATHLETE", style["cover_kicker"]))
    story.append(para("THE 90%<br/>MANIFESTO", style["cover_title"]))
    story.append(para("Why the invisible side of performance decides what shows up when the lights come on.", style["cover_sub"]))
    story.append(TopRule(0.45, BLUE, 5))
    story.append(Spacer(1, 0.14 * inch))
    story.append(para("For parents raising athletes who need more than reps, lessons, and motivation.", style["cover_sub"]))


def build_intro(story, style):
    story.append(PageBreak())
    author_lines = parse_author_blocks()
    title = author_lines[0] if author_lines else "About the Author"
    body = author_lines[1:] if len(author_lines) > 1 else []
    story.append(para("AUTHOR", style["chapter_num"]))
    story.append(para(title, style["chapter_title"]))
    story.append(TopRule(0.34, BLUE, 5))
    for line in body:
        if line == "The mind.":
            story.append(callout("THE MISSING SIDE", line, BLUE, style))
        elif line == "It was the same game...":
            story.append(quote_card("It was the same game... just played on a different field.", style))
        elif line == "Just played on a different field.":
            continue
        elif line.startswith("- "):
            story.append(Spacer(1, 8))
            story.append(para(line, style["section_blue"]))
        else:
            story.append(para(line, style["body"]))


def build_philosophy(story, style):
    story.append(PageBreak())
    lines = parse_philosophy_blocks()
    title = lines[0] if lines else "The Complete Athlete Philosophy"
    body = lines[1:] if len(lines) > 1 else []
    story.append(para("PHILOSOPHY", style["chapter_num"]))
    story.append(para(title, style["chapter_title"]))
    story.append(TopRule(0.34, BLUE, 5))
    skip_next = False
    for line in body:
        if skip_next:
            skip_next = False
            continue
        if line == '"Sports are 90% mental and 10% physical."':
            story.append(quote_card("Sports are 90% mental and 10% physical.", style))
        elif line == "What does that actually mean?":
            story.append(callout("THE QUESTION", line, FIELD, style))
        elif line == "The Complete Athlete is built on one simple belief:":
            story.append(para(line, style["body"]))
        elif line == "The body performs.":
            story.append(callout("THE COMPLETE ATHLETE BELIEF", "The body performs.<br/>The mind determines how consistently.", BLUE, style))
            skip_next = True
        elif line == "Welcome to The Complete Athlete.":
            story.append(Spacer(1, 8))
            story.append(callout("WELCOME", line, BLUE_DARK, style))
        else:
            story.append(para(line, style["body"]))


def build_toc(story, style):
    story.append(PageBreak())
    story.append(para("FIELD GUIDE", style["chapter_num"]))
    story.append(para("What You Will See Differently", style["chapter_title"]))
    for row in [
        "01  The Lie We All Believe",
        "02  The Person Behind the Performance",
        "03  The Athletic Operating System (aOS)",
        "04  The Architects of Belief",
        "05  The Law of Repetition",
        "06  Your Mind Doesn't Know the Difference",
        "07  The Journey to Becoming a Complete Athlete",
    ]:
        story.append(para(row, style["toc"]))
    story.append(Spacer(1, 0.2 * inch))
    story.append(callout("CORE PROMISE", "The athlete everyone sees on the field is the visible expression of what has been quietly built behind the scenes.", FIELD, style))


def build_soft_cta(story, style):
    story.append(PageBreak())
    story.append(Spacer(1, 0.55 * inch))
    story.append(para("A QUIET NEXT STEP", style["chapter_num"]))
    story.append(para("Train the Operating System Daily", style["cta_title"]))
    story.append(TopRule(0.42, BLUE, 5))
    story.append(Spacer(1, 0.12 * inch))
    story.append(para("If this chapter made you think differently about your athlete, start here:", style["cta_body"]))
    story.append(quote_card("Do not only ask, How do we fix the performance?<br/>Start asking, What is training the operating system behind the performance?", style))
    story.append(para("That is the work The Complete Athlete was built for.", style["cta_body"]))
    story.append(para("Inside the app, athletes learn how to reflect, reset, build confidence, strengthen identity, and repeat the right inputs daily - before pressure tests them.", style["cta_body"]))
    story.append(callout("THE DAILY WORK", "You do not have to wait for a bad game to train the mental side. You can begin building it now.", BLUE_DARK, style))
    button = Table([[para("Continue the journey inside The Complete Athlete.", style["cta_button"])]], colWidths=[4.8 * inch], hAlign="CENTER")
    button.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("BOX", (0, 0), (-1, -1), 0, BLUE),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
    ]))
    story.append(Spacer(1, 8))
    story.append(button)


def append_blocks(story, style):
    recent_reflection = False
    active_chapter = None
    cta_inserted = False
    for block in parse_blocks():
        kind = block[0]
        if kind == "chapter":
            if active_chapter == "CHAPTER 3" and not cta_inserted:
                build_soft_cta(story, style)
                cta_inserted = True
            active_chapter = block[1].upper()
            story.append(PageBreak())
            story.append(para(block[1].upper(), style["chapter_num"]))
            story.append(para(block[2], style["chapter_title"]))
            story.append(TopRule(0.34, BLUE, 5))
            if block[3]:
                story.append(quote_card(block[3].strip('"'), style))
            recent_reflection = False
        elif kind == "section":
            if block[1] == "Reflection":
                story.append(ReflectionBand())
                recent_reflection = True
            elif block[1] == "Closing":
                story.append(para("Carry It Forward", style["section_blue"]))
                recent_reflection = False
            else:
                story.append(para(block[1], style["section"]))
                recent_reflection = False
        elif kind == "quote":
            story.append(quote_card(block[1], style))
            recent_reflection = False
        elif kind == "callout":
            story.append(callout(block[1], block[2], block[3], style))
            recent_reflection = False
        elif kind == "framework_title":
            story.append(para(block[1], style["section"]))
        elif kind == "framework_graphic":
            story.append(FrameworkFlowable())
            story.append(Spacer(1, 6))
        elif kind == "question":
            if recent_reflection:
                story.append(reflection_question(block[1], style))
            else:
                story.append(para(block[1], style["question"]))
                story.append(AnswerLines(2))
        elif kind == "emphasis":
            story.append(para(block[1], style["emphasis"]))
            recent_reflection = False
        else:
            text = block[1]
            if recent_reflection and (text.endswith("?") or text.startswith(("What ", "If "))):
                story.append(reflection_question(text, style))
            else:
                story.append(para(text, style["breath"] if len(text) < 88 else style["body"]))


def build_closing(story, style):
    story.append(PageBreak())
    story.append(para("NEXT STEP", style["chapter_num"]))
    story.append(para("Make The 90% Daily", style["chapter_title"]))
    story.append(TopRule(0.35, BLUE, 5))
    story.append(para("The manifesto gives families the language. The Complete Athlete turns that language into a rhythm athletes can repeat.", style["body"]))
    story.append(callout("CONTINUE THE WORK", "Daily Deposits. Mindset coaching. Reflection. Shared parent-athlete language. A place to train the invisible side of performance every day.", BLUE_DARK, style))
    if APP_ICON.exists():
        icon = Image(str(APP_ICON), width=0.78 * inch, height=0.78 * inch)
        icon.hAlign = "CENTER"
        story.append(Spacer(1, 8))
        story.append(icon)
        story.append(Spacer(1, 6))
    story.append(para("The Complete Athlete", style["breath"]))


def build():
    register_fonts()
    style = make_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.62 * inch,
        rightMargin=0.62 * inch,
        topMargin=0.66 * inch,
        bottomMargin=0.62 * inch,
        title="The 90% Manifesto",
        author="The Complete Athlete",
    )
    story = []
    build_cover(story, style)
    build_intro(story, style)
    build_philosophy(story, style)
    build_toc(story, style)
    append_blocks(story, style)
    build_closing(story, style)
    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
    print(OUTPUT)


if __name__ == "__main__":
    build()
