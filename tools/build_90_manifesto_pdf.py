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
OUT_DIR = ROOT.parent / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = OUT_DIR / "The-90-Manifesto-Complete-Athlete-Edited.pdf"
COVER_IMAGE = ROOT / "public" / "plan-covers" / "90-percent-blueprint.jpg"
APP_ICON = ROOT / "public" / "app-icon.png"

PAGE_W, PAGE_H = letter

INK = colors.HexColor("#101614")
NIGHT = colors.HexColor("#151A18")
FIELD = colors.HexColor("#203028")
SURFACE = colors.HexColor("#F4F5EF")
LINE = colors.HexColor("#C9D0C2")
MUTED = colors.HexColor("#66716B")
GOLD = colors.HexColor("#F4C542")
RED = colors.HexColor("#D74A32")
GREEN = colors.HexColor("#4E7D62")
WHITE = colors.white


def register_fonts():
    font_dir = Path("/System/Library/Fonts/Supplemental")
    fonts = {
        "TCAHeadline": font_dir / "DIN Condensed Bold.ttf",
        "TCABody": font_dir / "Arial.ttf",
        "TCABodyBold": font_dir / "Arial Bold.ttf",
        "TCABodyItalic": font_dir / "Arial Italic.ttf",
        "TCASerif": font_dir / "Georgia.ttf",
        "TCASerifItalic": font_dir / "Georgia Italic.ttf",
    }
    for name, path in fonts.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))


class Rule(Flowable):
    def __init__(self, width=1.0, color=GOLD, height=4):
        super().__init__()
        self.width = width
        self.color = color
        self.height = height

    def wrap(self, availWidth, availHeight):
        self.availWidth = availWidth
        return availWidth, self.height + 8

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 2, self.availWidth * self.width, self.height, 2, fill=1, stroke=0)


class FrameworkFlowable(Flowable):
    labels = ["Inputs", "Beliefs", "Paradigm", "Identity", "Habits", "Performance"]

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        self.height = 252
        return availWidth, self.height

    def draw(self):
        c = self.canv
        box_h = 30
        gap = 12
        x = 0.35 * inch
        box_w = self.width - 0.7 * inch
        y = self.height - box_h
        c.setFont("TCABodyBold", 10.5)
        for i, label in enumerate(self.labels):
            yy = y - i * (box_h + gap)
            fill = [FIELD, GREEN, GOLD, INK, RED, FIELD][i]
            text_color = WHITE if fill != GOLD else INK
            c.setFillColor(fill)
            c.roundRect(x, yy, box_w, box_h, 6, fill=1, stroke=0)
            c.setFillColor(text_color)
            c.drawCentredString(x + box_w / 2, yy + 11, label.upper())
            if i < len(self.labels) - 1:
                c.setStrokeColor(MUTED)
                c.setLineWidth(1.2)
                mid = x + box_w / 2
                c.line(mid, yy - 2, mid, yy - gap + 5)
                c.setFillColor(MUTED)
                c.circle(mid, yy - gap + 2, 2.4, fill=1, stroke=0)


class AnswerLines(Flowable):
    def __init__(self, lines=3):
        super().__init__()
        self.lines = lines
        self.height = lines * 18 + 7

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, self.height

    def draw(self):
        self.canv.setStrokeColor(LINE)
        self.canv.setLineWidth(0.7)
        y = self.height - 12
        for _ in range(self.lines):
            self.canv.line(12, y, self.width - 12, y)
            y -= 18


def make_styles():
    base = getSampleStyleSheet()
    return {
        "kicker": ParagraphStyle(
            "kicker",
            parent=base["Normal"],
            fontName="TCABodyBold",
            fontSize=8.5,
            leading=10,
            textColor=GOLD,
            alignment=TA_LEFT,
            uppercase=True,
            spaceAfter=8,
        ),
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName="TCAHeadline",
            fontSize=58,
            leading=52,
            textColor=WHITE,
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Normal"],
            fontName="TCASerif",
            fontSize=15,
            leading=21,
            textColor=colors.HexColor("#E8ECE4"),
            spaceAfter=18,
        ),
        "chapter_num": ParagraphStyle(
            "chapter_num",
            parent=base["Normal"],
            fontName="TCABodyBold",
            fontSize=9,
            leading=11,
            textColor=RED,
            spaceAfter=7,
        ),
        "chapter_title": ParagraphStyle(
            "chapter_title",
            parent=base["Heading1"],
            fontName="TCAHeadline",
            fontSize=34,
            leading=34,
            textColor=INK,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="TCABodyBold",
            fontSize=13,
            leading=16,
            textColor=FIELD,
            spaceBefore=7,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName="TCABody",
            fontSize=10.8,
            leading=16.4,
            textColor=INK,
            spaceAfter=8,
        ),
        "body_big": ParagraphStyle(
            "body_big",
            parent=base["BodyText"],
            fontName="TCASerif",
            fontSize=12.2,
            leading=18,
            textColor=INK,
            spaceAfter=10,
        ),
        "quote": ParagraphStyle(
            "quote",
            parent=base["BodyText"],
            fontName="TCASerifItalic",
            fontSize=15,
            leading=20,
            textColor=INK,
            alignment=TA_CENTER,
        ),
        "callout_title": ParagraphStyle(
            "callout_title",
            parent=base["Normal"],
            fontName="TCABodyBold",
            fontSize=9,
            leading=11,
            textColor=WHITE,
            spaceAfter=5,
        ),
        "callout_body": ParagraphStyle(
            "callout_body",
            parent=base["Normal"],
            fontName="TCABodyBold",
            fontSize=12.5,
            leading=16,
            textColor=WHITE,
        ),
        "callout_dark": ParagraphStyle(
            "callout_dark",
            parent=base["Normal"],
            fontName="TCABodyBold",
            fontSize=12,
            leading=15.5,
            textColor=INK,
        ),
        "reflect": ParagraphStyle(
            "reflect",
            parent=base["Normal"],
            fontName="TCABody",
            fontSize=10.5,
            leading=15.5,
            leftIndent=12,
            firstLineIndent=-12,
            textColor=INK,
            spaceAfter=7,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontName="TCABody",
            fontSize=8,
            leading=10,
            textColor=MUTED,
        ),
        "toc": ParagraphStyle(
            "toc",
            parent=base["Normal"],
            fontName="TCABodyBold",
            fontSize=11,
            leading=15,
            textColor=INK,
            spaceAfter=6,
        ),
        "center_dark": ParagraphStyle(
            "center_dark",
            parent=base["Normal"],
            fontName="TCABodyBold",
            fontSize=12,
            leading=15,
            alignment=TA_CENTER,
            textColor=INK,
        ),
    }


def p(text, style):
    return Paragraph(text, style)


def callout(title, text, style, bg=FIELD, text_style="callout_body"):
    data = [[p(title.upper(), style["callout_title"]), p(text, style[text_style])]]
    table = Table(data, colWidths=[1.25 * inch, 4.45 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 13),
                ("RIGHTPADDING", (0, 0), (-1, -1), 13),
                ("TOPPADDING", (0, 0), (-1, -1), 13),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
                ("LINEBEFORE", (1, 0), (1, 0), 2, GOLD if bg != GOLD else FIELD),
            ]
        )
    )
    return KeepTogether([Spacer(1, 7), table, Spacer(1, 11)])


def quote_card(text, style):
    data = [[p(text, style["quote"])]]
    table = Table(data, colWidths=[5.7 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 1.1, LINE),
                ("LINEABOVE", (0, 0), (-1, 0), 5, GOLD),
                ("LEFTPADDING", (0, 0), (-1, -1), 20),
                ("RIGHTPADDING", (0, 0), (-1, -1), 20),
                ("TOPPADDING", (0, 0), (-1, -1), 17),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 17),
            ]
        )
    )
    return KeepTogether([Spacer(1, 8), table, Spacer(1, 12)])


def reflection(items, style):
    flow = [callout("Reflection", "Before you move on, answer these honestly.", style, bg=GREEN)]
    for idx, item in enumerate(items, 1):
        flow.append(p(f"{idx}. {item}", style["reflect"]))
        flow.append(AnswerLines(2))
    flow.append(Spacer(1, 8))
    return KeepTogether(flow)


def chapter(num, title, epigraph, body, style):
    flow = [PageBreak(), p(num.upper(), style["chapter_num"]), p(title, style["chapter_title"]), Rule(0.32, GOLD, 5)]
    flow.append(quote_card(epigraph, style))
    for block in body:
        kind = block[0]
        if kind == "p":
            flow.append(p(block[1], style["body"]))
        elif kind == "big":
            flow.append(p(block[1], style["body_big"]))
        elif kind == "h2":
            flow.append(p(block[1], style["h2"]))
        elif kind == "quote":
            flow.append(quote_card(block[1], style))
        elif kind == "callout":
            flow.append(callout(block[1], block[2], style, bg=block[3] if len(block) > 3 else FIELD))
        elif kind == "reflect":
            flow.append(reflection(block[1], style))
        elif kind == "framework":
            flow.append(Spacer(1, 8))
            flow.append(FrameworkFlowable())
            flow.append(Spacer(1, 12))
    return flow


MANUSCRIPT = [
    {
        "num": "Chapter One",
        "title": "The Lie We All Believe",
        "epigraph": "The greatest obstacle is not ignorance. It is being certain about the wrong thing.",
        "body": [
            ("big", "Most families enter youth sports through the same door. A child falls in love with a game. The calendar fills. Practices turn into tournaments. Tournaments turn into private lessons, travel weekends, strength sessions, specialty coaches, new gear, and one more thing that promises an edge."),
            ("p", "Then the athlete struggles. The answer feels obvious: more reps, more coaching, more training. So we add another lesson. Another camp. Another trainer. We tell ourselves the missing piece is out there somewhere, waiting to be purchased or scheduled."),
            ("p", "But what if the first question is wrong? What if the biggest obstacle standing between your athlete and their potential is not hiding in their swing, shot, stride, mechanics, or speed? What if it is happening in the six inches between their ears?"),
            ("p", "At the lowest levels, physical gaps can be enormous. One athlete is simply bigger, faster, or stronger. But as the level rises, everybody trains. Everybody has access to instruction. Everybody lifts. Everybody gets reps. The physical gap begins to shrink, and a different kind of separation begins."),
            ("p", "Two athletes can have the same talent, the same coach, the same schedule, and the same opportunity. Both fail. One carries the mistake into the next play. His breathing changes. His body tightens. His confidence leaves before the next chance even arrives. The other athlete takes a breath, gathers the lesson, and returns to the present. Same failure. Different recovery."),
            ("quote", "The difference was not talent. The difference was what happened after failure."),
            ("p", "Every coach teaches mechanics. Very few teach recovery. Every coach teaches technique. Very few teach identity. Every coach teaches strategy. Very few teach emotional control. That is not an insult to coaches. It is the reality of youth sports. A hitting coach should teach hitting. A shooting coach should teach shooting. A speed coach should teach speed."),
            ("p", "But who is teaching your athlete what to do when confidence disappears? Who is teaching them how to handle pressure, quiet negative self-talk, and stay disciplined when motivation fades? Those skills do not develop by accident just because a child plays a sport."),
            ("callout", "The 90% Principle", "Physical development opens the door. Mental development determines how often an athlete walks through it.", FIELD),
            ("p", "Imagine buying the fastest race car in the world and spending thousands upgrading the engine, tires, suspension, and paint. Then imagine never teaching the driver how to handle the car at 200 miles per hour. You would not expect the upgrades alone to produce championships. Yet families do this all the time. We keep upgrading the athlete's body while leaving the mind responsible for using it mostly untrained."),
            ("p", "That is where the 90% philosophy begins. Not because the body is unimportant. The body matters deeply. Skill matters. Strength matters. Coaching matters. But the mind influences every single thing the body expresses."),
            ("p", "Confidence affects mechanics. Pressure affects decision-making. Beliefs influence effort. Focus determines execution. Identity shapes consistency. The mind is not separate from performance. It is inside every pitch, shot, race, rep, mistake, comeback, and quiet decision."),
            ("quote", "Athletic success is 90% mental and 10% physical because the mind influences everything the body does."),
            ("reflect", [
                "When my athlete struggles, do I rush to fix mechanics before I understand mindset?",
                "What mental skill has no one intentionally taught my athlete yet?",
                "If confidence, resilience, and focus could be trained like strength or speed, would I make them part of the weekly routine?",
            ]),
        ],
    },
    {
        "num": "Chapter Two",
        "title": "The Person Behind the Performance",
        "epigraph": "Competition is rarely the beginning of the story. It is the chapter everyone happens to watch.",
        "body": [
            ("big", "Walk through a sporting goods store and you will find aisle after aisle of promises. A lighter bat. A faster glove. A better basketball. A shoe that claims to make an athlete quicker. None of those things are bad. But every athlete brings one piece of equipment into every game that cannot be bought off a shelf: the mind."),
            ("p", "A sculptor once stood in front of a block of marble and saw something others could not see. The masterpiece was not added to the stone. It was revealed by removing what did not belong. Athletes are similar. The greatest ones are not only adding more skill. They are removing fear, overthinking, comparison, distraction, and self-doubt so the competitor inside them can show up."),
            ("p", "This is why two athletes can leave the same practice as different people. One hears correction and feels exposed. Another hears correction and sees a doorway. One mistake convinces an athlete they are falling behind. The same mistake convinces another athlete they are getting closer. The event was identical. The interpretation was not."),
            ("callout", "Identity Shift", "One sentence says, 'I had a bad game.' The other says, 'I am bad under pressure.' One describes an event. The other describes a person.", GOLD, "callout_dark"),
            ("p", "The mind is constantly trying to answer one question: Who am I? Every experience becomes evidence. Strike out three games in a row, sit on the bench, miss the game-winner, and the mind starts collecting proof. If no one helps the athlete interpret those moments well, the athlete may turn a temporary event into a permanent label."),
            ("p", "Young athletes wear labels long before they realize they have them. I am too small. I am not fast enough. Coach does not believe in me. I am always nervous. I am just inconsistent. The scary part is not that those thoughts appear. The scary part is how quickly they become familiar. Familiarity can disguise itself as truth."),
            ("p", "Think about a trail through the woods. The first walk is awkward. Branches are in the way. The path is unclear. But after hundreds of steps, the ground hardens. The route becomes automatic. Thoughts work the same way. Every repeated thought cuts a path through the mind. The more often an athlete thinks, 'I choke under pressure,' the easier that thought is to find."),
            ("quote", "Events can change tomorrow. Identity follows an athlete everywhere."),
            ("p", "This changed the way I think about development. I stopped asking only, 'How do we help athletes perform better?' and started asking, 'Who are they practicing becoming?' Those are different questions. Every practice is doing more than improving mechanics. It is shaping beliefs, building habits, teaching responses, and forming identity."),
            ("p", "Long before the championship game arrives, the athlete who will play in that moment is already being built. Quietly. Daily. One repetition at a time."),
            ("reflect", [
                "What labels has my athlete accepted without realizing it?",
                "What story do they tell themselves after mistakes?",
                "If I could hear their inner voice for one entire game, would I want my child speaking to themselves that way?",
            ]),
        ],
    },
    {
        "num": "Chapter Three",
        "title": "The Invisible Program",
        "epigraph": "You do not see the game only as it is. You see it through the program you have practiced.",
        "body": [
            ("big", "Imagine buying a powerful computer with unlimited processing speed, then installing outdated software. No matter how advanced the machine is, the software decides what it can do. You would not blame the computer. You would update the program."),
            ("p", "Athletes often try to change performance without examining the program running underneath it. The conscious mind is like the captain of a ship. It chooses a destination, sets goals, dreams, plans, and says, 'I want to make varsity,' or, 'I want to be more confident.'"),
            ("p", "But below deck is the engine room. Powerful. Quiet. Working every second. That is the subconscious. While the conscious mind sets goals, the subconscious runs programs. One chooses. The other executes. And automatic behavior usually wins."),
            ("p", "You have driven somewhere and realized you barely remember the last ten minutes. You stopped at lights, turned at intersections, and stayed in your lane. Your subconscious had learned the pattern well enough to run it without constant attention. That is exactly what physical training is designed to do."),
            ("p", "A hitter does not consciously think about every muscle involved in a swing. A quarterback does not calculate every movement before the throw. Years of repetition moved the skill below conscious awareness. The subconscious took over."),
            ("p", "Mental training works the same way. The subconscious does not only automate movements. It automates beliefs, emotional responses, expectations, and meanings. If an athlete repeatedly tells themselves, 'I am not good under pressure,' that sentence eventually becomes more than a thought. It becomes a program."),
            ("callout", "Parking Brake", "Trying harder with the wrong program is like pressing the gas while the parking brake is still on. The engine gets louder. The athlete works harder. The result barely moves.", RED),
            ("p", "That is why motivation often wears off. The conscious mind says, 'Be confident.' The subconscious replies, 'That is not who we are.' The conscious mind says, 'Be aggressive.' The subconscious says, 'Last time we failed. Play it safe.' The athlete feels stuck, not because they lack desire, but because two programs are fighting for control."),
            ("p", "Bob Proctor often used the word paradigm to describe a collection of deeply rooted beliefs, emotional patterns, and automatic behaviors that quietly controls the way a person lives. Every athlete has one. Every parent has one. It is the invisible operating system beneath visible performance."),
            ("quote", "The event is not the deciding factor. The paradigm decides what the event means."),
            ("p", "A strikeout does not create insecurity. The meaning attached to the strikeout does. A coach's correction does not create confidence. The meaning attached to the correction does. Life gives athletes experiences. Their paradigm tells them what those experiences mean. Then they mistake those meanings for truth."),
            ("p", "This is why behavior is usually a symptom. Parents see inconsistent effort and demand more effort. They see fear and demand more courage. They see poor decisions and demand better decisions. Sometimes that helps for a moment. But if the program beneath the behavior stays the same, the same pattern returns."),
            ("p", "The purpose of mental performance is not to hype athletes up before games. It is to intentionally rewrite the invisible program that quietly shapes every visible performance."),
            ("reflect", [
                "If my athlete's subconscious could speak today, would it say pressure is exciting or dangerous?",
                "Would it say mistakes help me grow or mistakes prove I am not good enough?",
                "What program is being repeated so often that it now feels automatic?",
            ]),
        ],
    },
    {
        "num": "Chapter Four",
        "title": "The Architects of Belief",
        "epigraph": "Every belief your athlete carries was built by something. Nothing simply appears.",
        "body": [
            ("big", "Stand in front of a beautiful home and most people notice the paint, windows, roof, and landscaping. Few people think about the blueprint, the foundation, and the thousands of unseen decisions that made the house possible. Belief works the same way."),
            ("p", "When an athlete steps into pressure with confidence, you are seeing the finished house, not the years of construction. When an athlete crumbles after one mistake, you are also seeing the finished house, not the blueprint that quietly produced it. Beliefs are not random. They are constructed one experience, one conversation, one relationship, and one repeated message at a time."),
            ("callout", "Four Architects", "Environment. Association. Information. Experience. Whether intentional or accidental, these four forces are always building.", FIELD),
            ("h2", "1. Environment"),
            ("p", "Before your athlete ever met a coach, wore a jersey, or learned the rules, they lived inside an environment: your home. By graduation, your child will have spent thousands more hours inside your home than with any private instructor. More hours listening than speaking. More hours watching than participating. More hours absorbing how adults respond to pressure, disappointment, conflict, gratitude, and failure."),
            ("p", "Home is the first locker room every athlete enters. Every home has a culture, not because it is written down, but because it is lived. Some homes teach, 'We learn from mistakes.' Others unintentionally teach, 'Do not make mistakes.' Some homes make children safe enough to fail. Others make children afraid to try."),
            ("quote", "The atmosphere outside eventually becomes the voice inside."),
            ("p", "Think about the ride home after a game. Your child is not just listening to your words. They are trying to answer a question they will carry for years: Who am I? If the atmosphere says, 'You are loved because you performed,' competition becomes survival. If it says, 'You are loved before you perform,' competition becomes freedom."),
            ("h2", "2. Association"),
            ("p", "Human beings are contagious. Spend enough time around hopeful people and hope begins to feel normal. Spend enough time around complainers and complaining starts to sound reasonable. Spend enough time around disciplined people and discipline becomes expected."),
            ("p", "Parents usually ask whether their child has good friends. That matters. A deeper question is this: who is teaching your athlete what normal looks like? If every teammate blames the umpire, blame becomes normal. If every conversation revolves around comparison, comparison becomes the lens. Association changes standards quietly until we begin calling things normal that once would have surprised us."),
            ("h2", "3. Information"),
            ("p", "Every swipe teaches. Every video teaches. Every comment section teaches. Every coach, podcast, highlight, caption, and group chat teaches. Information does not ask permission before shaping belief. It simply arrives, repeatedly."),
            ("p", "No loving parent would feed a child junk food for every meal because what repeatedly enters the body eventually affects the body. The mind is no different. Every repeated message becomes mental nutrition. Some messages nourish. Others slowly weaken."),
            ("h2", "4. Experience"),
            ("p", "Being cut. Winning a championship. A devastating injury. A coach's encouragement. A game-winning hit. A public failure. These moments stay with us, but events do not automatically become beliefs. Meaning becomes belief."),
            ("p", "Two athletes can experience the same setback. One leaves believing, 'This is where my story ends.' The other leaves believing, 'This is where my story begins.' The experience was identical. The interpretation was not. That interpretation passes through the athlete's environment, associations, information, and existing paradigm."),
            ("reflect", [
                "Who are the builders in my athlete's life right now?",
                "What culture exists inside our home after wins and after losses?",
                "What voices shape my athlete before bed, before games, and after mistakes?",
                "How is my athlete learning to interpret failure?",
            ]),
        ],
    },
    {
        "num": "Chapter Five",
        "title": "The Law of Repetition",
        "epigraph": "Every repetition teaches the subconscious one answer to the question: Who am I?",
        "body": [
            ("big", "Walk into a batting cage, a weight room, a pool, a track, or an empty gym after practice and you will see repetition. Athletes know that if you want to own a skill, you repeat it. Over and over again."),
            ("p", "But here is the question almost nobody asks: if repetition builds mechanics, what builds the athlete? The answer is the same. Repetition."),
            ("p", "Every day your athlete repeats something. Not just swings, shots, routes, starts, cuts, or free throws. They repeat thoughts. They repeat emotional reactions. They repeat expectations. They repeat stories. They repeat beliefs."),
            ("p", "The subconscious does not separate physical repetitions from mental repetitions. It asks, 'Is this important enough to automate?' If the answer is yes, it begins building a program."),
            ("p", "An athlete who constantly says, 'I am always nervous before games,' is rehearsing. An athlete who relives yesterday's mistake ten times is rehearsing. An athlete who expects failure before the first whistle is rehearsing. We think rehearsal only happens on a field. It does not. The mind rehearses all day long."),
            ("quote", "Pressure does not create new behavior. It exposes the behavior the subconscious trusts most."),
            ("p", "That is why some athletes dominate in practice and look like a different person in competition. Their mechanics did not disappear. Their program took over. Under pressure, athletes do not suddenly invent confidence. They return to what has been repeated most."),
            ("p", "Language matters because the subconscious is always listening. Every time an athlete says, 'I cannot,' it takes notes. Every time they say, 'I am just not that kind of player,' it takes notes. Eventually, those words stop sounding like opinions and become instructions."),
            ("p", "Now imagine a different rehearsal. I recover quickly. Pressure reveals my preparation. Mistakes teach me. I compete with courage. At first those statements may feel unfamiliar, maybe even uncomfortable. That is normal. Every new program feels unnatural in the beginning. Growth often feels awkward before it feels natural, natural before it becomes automatic, and automatic before it becomes identity."),
            ("callout", "Daily Deposit", "A journal entry is not just writing. A gratitude choice is not just positivity. Keeping one small promise is not just discipline. Each one is a mental repetition.", GREEN),
            ("p", "Real transformation is usually quieter than people expect. It is one thought repeated. One habit repeated. One truth repeated. One response repeated. Until the subconscious stops resisting and starts believing."),
            ("reflect", [
                "What thought has my athlete repeated so often that it now feels like a fact?",
                "What language do they hear most often from coaches, teammates, parents, and themselves?",
                "What identity is being rehearsed every day without anyone naming it?",
            ]),
        ],
    },
    {
        "num": "Chapter Six",
        "title": "Your Mind Already Practiced It",
        "epigraph": "Long before an athlete performs on the field, they have already performed somewhere in the mind.",
        "body": [
            ("big", "Close your eyes for a moment and imagine cutting into a fresh lemon. See the yellow skin. Hear the knife touch the cutting board. Watch the juice gather. Now bring a slice toward your mouth and take a bite."),
            ("p", "If you are like most people, your mouth reacted. There was no lemon, no knife, no juice, and no bite. Still, your body responded as if the experience were real. A thought created a physical response."),
            ("p", "That simple exercise reveals something powerful. The subconscious responds to pictures, emotions, and stories it repeatedly experiences, whether those experiences happen on a field or inside imagination."),
            ("p", "Sports psychologists have used mental rehearsal for decades. Olympic athletes use it. Professionals use it. Not because visualization is magic, but because vividly imagined experiences create familiarity. When an athlete repeatedly sees themselves executing with confidence, staying composed under pressure, and recovering after mistakes, they are not merely thinking positive. They are practicing."),
            ("p", "The opposite is also true. Many young athletes rehearse striking out before they step into the box. They replay yesterday's mistake before today's game. They imagine disappointing a coach, embarrassing themselves, or letting the team down. They do not realize it, but they are practicing too."),
            ("quote", "The subconscious does not only ask, Did this happen? It asks, Is this familiar?"),
            ("p", "This brings the whole manifesto into one framework. Not because life is simple, but because clear language gives families something they can use."),
            ("h2", "The Complete Athlete Framework"),
            ("callout", "The Complete Athlete Framework", "Inputs to Beliefs to Paradigm to Identity to Habits to Performance.", FIELD),
            ("framework",),
            ("h2", "Inputs"),
            ("p", "Everything your athlete experiences: home environment, friendships, coaching, words, videos, conversations after games, wins, losses, and the private thoughts no one else hears. These are the raw materials."),
            ("h2", "Beliefs"),
            ("p", "Inputs become interpretations. I am capable. I am behind. Pressure is exciting. Pressure is dangerous. These beliefs become lenses."),
            ("h2", "Paradigm"),
            ("p", "Repeated beliefs become accepted by the subconscious. The paradigm is the operating system that does not constantly ask whether something is true. It asks whether this is what we have learned to believe."),
            ("h2", "Identity"),
            ("p", "After enough repetition, the athlete stops saying, 'I believe I can recover,' and starts saying, 'I recover.' Identity is the subconscious answering, 'Who am I?'"),
            ("h2", "Habits"),
            ("p", "Identity looks for consistency. A disciplined athlete acts like disciplined people act. A fearful athlete behaves in ways that protect the old identity."),
            ("h2", "Performance"),
            ("p", "Finally, performance appears. Most people start here. The Complete Athlete starts at the top, because performance is the visible expression of everything that came before it."),
            ("quote", "The scoreboard reveals. It does not create."),
            ("p", "Read the framework backward and the path becomes clear. Performance improves when habits improve. Habits improve when identity changes. Identity changes when the paradigm changes. The paradigm changes when beliefs change. Beliefs change when inputs change."),
            ("reflect", [
                "What is my athlete rehearsing when no one is watching?",
                "Which input needs to change first: home, association, information, or experience?",
                "What belief would change the way my athlete carries pressure?",
            ]),
        ],
    },
    {
        "num": "Final Chapter",
        "title": "Build the Complete Athlete",
        "epigraph": "The greatest victory in sports is not becoming a better athlete. It is becoming a better person because you were an athlete.",
        "body": [
            ("big", "If you have read this far, you probably see the game differently now. Athletic success is not only the right mechanics, the right coach, the right training program, or the right opportunity. Those things matter. They always will. But every performance has a story behind it."),
            ("p", "Every habit has a belief behind it. Every belief has an origin. Every athlete competes with more than the opponent across from them. They compete with the person they have been becoming for years."),
            ("quote", "The field is not where confidence is created. It is where confidence is revealed."),
            ("p", "The game is not where identity is formed. It is where identity is tested. Pressure does not create character. It uncovers the character that has already been quietly built. The real work happens long before the lights come on."),
            ("p", "For years, youth sports has focused almost entirely on performance. But lasting transformation begins higher up the chain. Change the inputs and you begin changing beliefs. Change beliefs and you begin changing identity. Change identity and behavior begins changing naturally. When behavior changes consistently, performance eventually follows."),
            ("p", "That is the 90%. Not because the body is unimportant, but because the mind influences everything the body expresses."),
            ("callout", "No One-Off Speeches", "Your athlete does not need another motivational speech. They need consistent mental conditioning.", RED),
            ("p", "No coach expects one batting lesson to create a great hitter. So why would we expect one conversation to build an unshakable mindset? Mental performance is not an event. It is a daily practice."),
            ("p", "That is why The Complete Athlete exists. Not to replace coaches, practices, strength training, private lessons, or the other ten percent families already invest in. It exists to train the invisible side of performance that too often gets left to chance."),
            ("p", "Imagine an athlete who spends years training both: mechanics and mindset, strength and self-control, skill and resilience, talent and character. One trains the body. The other trains the person responsible for using that body."),
            ("quote", "A Complete Athlete is not perfect. A Complete Athlete is growing in every area competition demands."),
            ("p", "Whether your athlete eventually plays in college, plays professionally, or carries these lessons into adulthood, the investment is worth making. Confidence does not only help in sports. Discipline does not only matter on a field. Resilience does not retire after the final game. Character never goes out of season."),
            ("p", "So do not let this become another inspiring read that sits on a shelf. Talk about it at dinner. Ask different questions after games. Protect the culture of your home. Pay attention to the voices shaping your athlete. Celebrate courage as much as outcomes. Help your child build beliefs worth carrying for the rest of their life."),
            ("callout", "Continue the Work", "The Complete Athlete is where this becomes daily: reflection, identity, mindset coaching, Daily Deposits, and a shared language for athletes and parents.", GREEN),
            ("p", "One day, the scoreboards will stop lighting up. The trophies will gather dust. The uniforms will no longer fit. People may forget the statistics, championships, and highlights. But your athlete will wake up every morning as the person they became through the journey."),
            ("p", "Do not spend these years only building a better player. Build a stronger thinker. A steadier competitor. A resilient leader. A person of character. Build someone who knows who they are before the world tells them who they should be."),
            ("big", "That is no longer chasing athletic success. That is building a Complete Athlete."),
        ],
    },
]


def cover(story, style):
    story.append(Spacer(1, 0.3 * inch))
    img = Image(str(COVER_IMAGE), width=6.9 * inch, height=3.88 * inch)
    img.hAlign = "CENTER"
    story.append(img)
    story.append(Spacer(1, 0.33 * inch))
    story.append(p("THE COMPLETE ATHLETE", style["kicker"]))
    story.append(p("THE 90%<br/>MANIFESTO", style["title"]))
    story.append(p("Why the invisible side of performance decides what shows up when the lights come on.", style["subtitle"]))
    story.append(Rule(0.45, GOLD, 5))
    story.append(Spacer(1, 0.18 * inch))
    story.append(p("For parents raising athletes who need more than reps, lessons, and motivation.", style["subtitle"]))


def manifesto_page(story, style):
    story.append(PageBreak())
    story.append(p("READ THIS FIRST", style["chapter_num"]))
    story.append(p("A Manifesto For The Invisible Game", style["chapter_title"]))
    story.append(Rule(0.42, GOLD, 5))
    story.append(p("This is not a case against physical training. Great athletes still need skill, strength, speed, coaching, discipline, and reps. The 90% is not a math problem. It is a warning label.", style["body_big"]))
    story.append(quote_card("If the mind is left untrained, the body eventually runs into a ceiling it cannot outwork.", style))
    story.append(p("Most families invest heavily in the visible side of development because it is easier to see. A swing can be filmed. A sprint can be timed. A vertical can be measured. But confidence, identity, recovery, focus, and belief are often the difference between a trained athlete and a complete one.", style["body"]))
    story.append(p("Use this manifesto as a new lens. Read it slowly. Mark the lines that sting a little. Bring the reflection questions to the dinner table, the ride home, or the quiet moment after a hard game. The goal is not to become a perfect sports parent. The goal is to become more intentional about what is shaping your athlete every day.", style["body"]))


def toc_page(story, style):
    story.append(PageBreak())
    story.append(p("FIELD GUIDE", style["chapter_num"]))
    story.append(p("What You Will See Differently", style["chapter_title"]))
    rows = [
        "01  The Lie We All Believe",
        "02  The Person Behind the Performance",
        "03  The Invisible Program",
        "04  The Architects of Belief",
        "05  The Law of Repetition",
        "06  Your Mind Already Practiced It",
        "07  Build the Complete Athlete",
    ]
    for row in rows:
        story.append(p(row, style["toc"]))
    story.append(Spacer(1, 0.25 * inch))
    story.append(callout("Core Promise", "The athlete everyone sees on the field is the visible expression of what has been built in private.", style, FIELD))


def closing_page(story, style):
    story.append(PageBreak())
    story.append(p("THE NEXT STEP", style["chapter_num"]))
    story.append(p("Make The 90% Daily", style["chapter_title"]))
    story.append(Rule(0.35, GOLD, 5))
    story.append(p("Awareness is the beginning. Repetition is the builder. The Complete Athlete turns these ideas into a daily rhythm athletes and parents can actually live with.", style["body_big"]))
    data = [
        [p("Daily Deposits", style["center_dark"]), p("Small mindset repetitions that help the right beliefs become familiar.", style["body"])],
        [p("Mindset Coach", style["center_dark"]), p("A guided place for athletes to process pressure, confidence, mistakes, goals, and identity.", style["body"])],
        [p("Parent Language", style["center_dark"]), p("Shared ideas parents and athletes can use after games, during setbacks, and in ordinary weeks.", style["body"])],
    ]
    table = Table(data, colWidths=[1.65 * inch, 4.05 * inch], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 1, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.25 * inch))
    story.append(callout("The Invitation", "Do not only read about mental performance. Build it into the way your athlete trains, reflects, recovers, and sees themselves.", style, GREEN))
    if APP_ICON.exists():
        icon = Image(str(APP_ICON), width=0.85 * inch, height=0.85 * inch)
        icon.hAlign = "LEFT"
        story.append(icon)
    story.append(p("The Complete Athlete", style["body_big"]))


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(SURFACE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page = doc.page
    if page == 1:
        canvas.setFillColor(NIGHT)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.08))
        for x in range(0, int(PAGE_W), 42):
            canvas.rect(x, 0, 0.5, PAGE_H, fill=1, stroke=0)
        for y in range(0, int(PAGE_H), 42):
            canvas.rect(0, y, PAGE_W, 0.5, fill=1, stroke=0)
    else:
        canvas.setFillColor(FIELD)
        canvas.rect(0, PAGE_H - 0.32 * inch, PAGE_W, 0.32 * inch, fill=1, stroke=0)
        canvas.setFillColor(GOLD)
        canvas.rect(0, PAGE_H - 0.32 * inch, 1.1 * inch, 0.32 * inch, fill=1, stroke=0)
        canvas.setFillColor(MUTED)
        canvas.setFont("TCABody", 7.5)
        canvas.drawString(0.58 * inch, 0.34 * inch, "The 90% Manifesto")
        canvas.drawRightString(PAGE_W - 0.58 * inch, 0.34 * inch, f"{page}")
    canvas.restoreState()


def build():
    register_fonts()
    style = make_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.68 * inch,
        bottomMargin=0.62 * inch,
        title="The 90% Manifesto",
        author="The Complete Athlete",
    )
    story = []
    cover(story, style)
    manifesto_page(story, style)
    toc_page(story, style)
    for item in MANUSCRIPT:
        story.extend(chapter(item["num"], item["title"], item["epigraph"], item["body"], style))
    closing_page(story, style)
    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
    print(OUTPUT)


if __name__ == "__main__":
    build()
