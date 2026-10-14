"""Development only: turns the messy development data into a believable showcase.

It renames the demo accounts to realistic names, hides (archives) the clutter that browser tests left in the
classes, then builds real syllabi, lessons, quizzes, activities, an exam, announcements, student progress,
scores, released results and published midterm grades, all through the app's own HTTP API in-process.
Archived work stays in the database (nothing is deleted).

    cd backend && .venv/Scripts/python -m tools.seed_showcase

Refuses to run outside development, or twice (it looks for its own first lesson).
"""
import random
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.config import settings
from app.db import SessionLocal
from app.features.accounts.models import Account
from app.main import app
from app.security import passwords

PASSWORD = "LearnSync-demo-2026"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
NAMES = {"admin@example.com": "Elena Cruz", "faculty1@example.com": "Prof. Maria Santos",
         "faculty2@example.com": "Prof. Daniel Reyes", "student1@example.com": "Mika Villanueva",
         "student2@example.com": "Paolo Garcia", "student3@example.com": "Bea Mendoza"}
POLICY = {"categories": [{"key": "quiz", "label": "Quizzes", "weight": 30},
                         {"key": "activity", "label": "Activities", "weight": 20},
                         {"key": "exam", "label": "Examinations", "weight": 50}],
          "periods": [{"key": "midterm", "label": "Midterm", "share": 50},
                      {"key": "finals", "label": "Finals", "share": 50}],
          "transmutation": "raw", "passing": 75, "late_attendance_fraction": 0.5}


def uid():
    return str(uuid.uuid4())


def hours(delta):
    return (datetime.now(UTC) + timedelta(hours=delta)).isoformat()


class Api:
    def __init__(self, email):
        self.c = TestClient(app)
        csrf = self.c.get("/api/auth/session").json()["csrf"]
        origin = {"Origin": "http://127.0.0.1:5173"}
        r = self.c.post("/api/auth/login", headers={**origin, "X-CSRF-Token": csrf}, json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, (email, r.text)
        self.h = {**origin, "X-CSRF-Token": r.json()["csrf"]}

    def ok(self, r, what):
        assert r.status_code < 300, f"{what}: {r.status_code} {r.text[:300]}"
        return r.json() if r.content else None

    def get(self, u, what="get"): return self.ok(self.c.get(u, headers=self.h), what + " " + u)
    def post(self, u, j=None, what="post"): return self.ok(self.c.post(u, headers=self.h, json=j), what + " " + u)
    def put(self, u, j=None, what="put"): return self.ok(self.c.put(u, headers=self.h, json=j), what + " " + u)
    def patch(self, u, j=None, what="patch"): return self.ok(self.c.patch(u, headers=self.h, json=j), what + " " + u)
    def raw_post(self, u, j=None): return self.c.post(u, headers=self.h, json=j)
    def upload(self, u, name, content, data=None):
        return self.c.post(u, headers=self.h, data=data or {}, files={"file": (name, content)})


def html(intro, points, quote=None):
    out = f"<h2>Overview</h2><p>{intro}</p><h2>Key ideas</h2><ul>" + "".join(f"<li>{p}</li>" for p in points) + "</ul>"
    if quote:
        out += f"<blockquote>{quote}</blockquote>"
    return out


def mc(prompt, choices, right, points=2):
    cs = [{"id": uid(), "text": t} for t in choices]
    return {"key": uid(), "type": "multiple_choice", "prompt": prompt, "choices": cs, "correct": cs[right]["id"],
            "explanation": "Review the lesson on this topic.", "points": points}


def tf(prompt, right, points=1):
    return {"key": uid(), "type": "true_false", "prompt": prompt, "choices": [], "correct": right,
            "explanation": "Review the lesson on this topic.", "points": points}


def short(prompt, accepted, points=2):
    return {"key": uid(), "type": "short_answer", "prompt": prompt, "choices": [], "correct": list(accepted),
            "explanation": "Review the lesson on this topic.", "points": points}


TIPS = ["Try it: write down one real example from your own life before the next class.",
        "Remember: understanding beats memorising. If you can explain it to a friend, you know it.",
        "Check yourself: close the page and list the key ideas from memory, then compare.",
        "Discuss it: pick one idea from this lesson and ask a classmate whether they agree."]

# code -> (course name, outcomes, chapters[(title, weeks, [(topic, [(lesson title, intro, points)])])], quizzes, activities, exam)
SPEC = {
    "ENT 101": dict(
        outcomes=["Explain what entrepreneurship is and why it matters", "Spot a real customer problem worth solving", "Describe the basic parts of a business model"],
        chapters=[
            ("Chapter 1 · Foundations of Entrepreneurship", "Weeks 1-3", [
                ("What is entrepreneurship?", [
                    ("Welcome to Entrepreneurship", "Entrepreneurship is the practice of spotting a need and organising people, money and ideas to meet it.", ["Entrepreneurs create value, not just businesses", "Risk is managed, not avoided", "Every venture starts with a real problem"]),
                    ("Entrepreneurs, owners and managers", "Owning a business, managing one and starting one are different jobs with different habits.", ["Owners hold the risk and the reward", "Managers run what already exists", "Entrepreneurs build what does not exist yet"])]),
                ("Finding opportunities", [
                    ("Where ideas come from", "Good ideas usually come from daily frustrations, changing habits and gaps that incumbents ignore.", ["Start with a person, not a product", "Look for repeated complaints", "Small markets can still be profitable"]),
                    ("Testing an idea cheaply", "Before building anything, run a small test that tells you whether customers care.", ["Talk to ten customers first", "Sell before you build", "Measure what people do, not what they say"])])]),
            ("Chapter 2 · Planning the Venture", "Weeks 4-6", [
                ("The business model", [
                    ("The business model canvas", "A business model describes who you serve, what you offer and how the money works, on one page.", ["Customer segments and value proposition", "Channels and relationships", "Revenue streams and costs"]),
                    ("Pricing and unit economics", "Price must cover the cost of serving one customer and leave something over.", ["Know your cost per unit", "Price on value, not only cost", "Watch the margin per sale"])]),
                ("Legal forms and funding", [
                    ("Choosing a legal structure", "Sole proprietorships, partnerships and corporations differ in liability, cost and control.", ["A sole proprietor has unlimited liability", "Partners share profit and risk", "A corporation is a separate legal person"]),
                    ("Funding a start-up", "Money can come from savings, family, loans, investors or customers paying early.", ["Bootstrapping keeps control", "Debt must be repaid, equity is shared", "Pre-sales are the cheapest funding"])])]),
        ],
        quizzes=[("Quiz 1: Entrepreneurship basics", "midterm", 0, [
            mc("What does an entrepreneur mainly do?", ["Manage existing staff", "Create value by meeting a need", "Avoid all risk", "Copy competitors"], 1),
            tf("Selling before you build is a cheap way to test an idea.", True),
            mc("Who carries the risk and reward of a business?", ["The customer", "The owner", "The supplier", "The auditor"], 1),
            short("Name one source of business ideas.", ["customer problems", "daily frustrations", "gaps in the market", "problems"])]),
            ("Quiz 2: Business model and legal forms", "finals", 0, [
                mc("Which legal form has unlimited personal liability?", ["Corporation", "Sole proprietorship", "Cooperative", "Foundation"], 1),
                tf("Pricing only needs to cover your cost.", False),
                mc("Which is a revenue stream?", ["Rent paid", "Subscription fees", "Raw materials", "Salaries"], 1),
                short("What does a business model canvas describe on one page?", ["how the business works", "business model", "how the money works"])])],
        activities=[("Activity 1: Interview three customers", "midterm", 50, -96, "Interview three people about a problem they face. Summarise what you heard in one page."),
                    ("Activity 2: Business model canvas", "finals", 50, 120, "Fill in the business model canvas for your own venture idea and upload it as a PDF.")],
        exam=("Midterm Examination", 100),
        announcements=[("Welcome to ENT 101", "Welcome, everyone. Read the first lesson before our next meeting and bring one problem you have noticed in your own community."),
                       ("Activity 1 is due this week", "Please submit your customer interview summary as a PDF. Short and honest beats long and polished.")]),
    "ENT 102": dict(
        outcomes=["Compare opportunities using simple criteria", "Estimate market size and demand", "Present a recommendation with evidence"],
        chapters=[
            ("Chapter 1 · Reading the Market", "Weeks 1-3", [("Market research", [
                ("Primary and secondary research", "Primary research is collected first-hand; secondary research reuses what others have published.", ["Surveys and interviews are primary", "Reports and statistics are secondary", "Combine both to reduce blind spots"]),
                ("Sizing a market", "A rough market size tells you whether an opportunity is worth the effort.", ["Total, serviceable and obtainable market", "Start from customers, not from the economy", "State your assumptions"])])]),
            ("Chapter 2 · Comparing Opportunities", "Weeks 4-6", [("Screening ideas", [
                ("Opportunity screening criteria", "Score every idea against the same criteria so the choice is fair.", ["Demand and growth", "Competition and barriers", "Fit with your skills"]),
                ("Feasibility in four parts", "Check market, technical, financial and organisational feasibility before committing.", ["Can it be made?", "Will they buy it?", "Does the money work?"])])])],
        quizzes=[("Quiz 1: Market research", "midterm", 0, [
            mc("Which is primary research?", ["A government report", "A customer interview", "A news article", "A textbook"], 1),
            tf("A market size estimate should state its assumptions.", True),
            short("What does SAM stand for in market sizing?", ["serviceable available market", "serviceable addressable market"]),
            mc("Why score ideas against the same criteria?", ["It is faster", "It keeps the choice fair", "It hides risk", "It lowers cost"], 1)])],
        activities=[("Activity 1: Screen three ideas", "midterm", 50, -72, "Score three business ideas against the screening criteria and recommend one."),
                    ("Activity 2: Feasibility memo", "finals", 50, 96, "Write a one-page feasibility memo for your chosen idea.")],
        exam=("Midterm Examination", 100),
        announcements=[("Welcome to ENT 102", "This course builds on ENT 101. We will compare opportunities and defend a recommendation with evidence."),
                       ("Bring a calculator on Friday", "We will size a market together in class.")]),
    "GE 101": dict(
        outcomes=["Describe the self from several perspectives", "Reflect on personal strengths and habits", "Connect self-understanding to goals"],
        chapters=[
            ("Chapter 1 · Perspectives on the Self", "Weeks 1-3", [("Who am I?", [
                ("Philosophical views of the self", "Philosophers have long asked what makes a person the same person over time.", ["Socrates: know thyself", "Descartes: the thinking self", "Hume: the self as a bundle of experiences"]),
                ("The self in psychology", "Psychology studies the self through traits, motives and the stories we tell about ourselves.", ["Self-concept and self-esteem", "The looking-glass self", "Identity is shaped over time"])])]),
            ("Chapter 2 · Growing as a Person", "Weeks 4-6", [("Habits and goals", [
                ("Strengths and habits", "Knowing your strengths helps you choose habits that actually stick.", ["Name three strengths", "Link a habit to a cue", "Track one small change"]),
                ("Setting goals that fit you", "Goals work best when they are specific, personal and reviewed often.", ["Specific and measurable", "Tied to what you value", "Reviewed weekly"])])])],
        quizzes=[("Quiz 1: Views of the self", "midterm", 0, [
            mc("Which philosopher said \"Know thyself\"?", ["Socrates", "Descartes", "Hume", "Locke"], 0),
            tf("Identity can change as we grow.", True),
            short("What is the term for how we think about ourselves?", ["self-concept", "self concept"]),
            mc("A habit sticks best when it is tied to a…", ["Cue", "Prize", "Deadline", "Rival"], 0)])],
        activities=[("Activity 1: Personal strengths reflection", "midterm", 50, -48, "Write a short reflection on three of your strengths and how you use them."),
                    ("Activity 2: My goal plan", "finals", 50, 144, "Write one goal for this term and the weekly steps you will take.")],
        exam=("Midterm Examination", 100),
        announcements=[("Welcome to Understanding the Self", "We start with big questions and end with small, practical habits."),
                       ("Journal reminder", "Bring your reflection notebook to the next class.")]),
    "GE 102": dict(
        outcomes=["Recognise patterns and use them to predict", "Apply logic to everyday problems", "Use data to make a decision"],
        chapters=[
            ("Chapter 1 · Patterns and Numbers", "Weeks 1-3", [("Patterns", [
                ("Patterns in nature and art", "Many patterns, from sunflower seeds to tiled floors, follow simple mathematical rules.", ["Sequences and the Fibonacci numbers", "Symmetry and tessellations", "Predicting the next term"]),
                ("Describing patterns with rules", "A rule turns a pattern into something we can predict and check.", ["Write the rule in words", "Write it with symbols", "Test it on new terms"])])]),
            ("Chapter 2 · Logic and Data", "Weeks 4-6", [("Reasoning", [
                ("Statements and truth tables", "Logic gives us a precise way to say when an argument holds.", ["Statements are true or false", "And, or and not", "A truth table lists every case"]),
                ("Reading data and charts", "Charts help us see a story in numbers, but they can also mislead.", ["Check the axes", "Compare like with like", "Ask what is missing"])])])],
        quizzes=[("Quiz 1: Patterns and logic", "midterm", 0, [
            mc("What is the next number: 1, 1, 2, 3, 5, …?", ["6", "7", "8", "9"], 2),
            tf("A statement is either true or false.", True),
            short("What do we call a table that lists every truth case?", ["truth table"]),
            mc("Which should you check first on a chart?", ["The colours", "The axes", "The title font", "The legend order"], 1)])],
        activities=[("Activity 1: Find a pattern", "midterm", 50, -60, "Photograph a pattern around you and write the rule that describes it."),
                    ("Activity 2: Reading a chart", "finals", 50, 108, "Find a chart in the news and explain what it shows and what it hides.")],
        exam=("Midterm Examination", 100),
        announcements=[("Welcome to Mathematics in the Modern World", "Maths is everywhere. We start by looking for it."),
                       ("Scientific calculators", "A basic calculator is enough for this course.")]),
}


def main():
    if settings().app_env != "development":
        raise SystemExit("Refusing: development only.")
    db = SessionLocal()
    try:
        # 1) realistic names (dev accounts only), and a known password for Cara so she can take part
        for email, name in NAMES.items():
            acc = db.scalar(select(Account).where(Account.email == email))
            if acc:
                acc.display_name = name
        cara = db.scalar(select(Account).where(Account.email == "cara@example.com"))
        if cara:
            cara.password_hash = passwords.hash(PASSWORD)
        db.commit()
    finally:
        db.close()

    fac = Api("faculty1@example.com")
    offerings = fac.get("/api/me/offerings")
    if any(o["subject"]["code"] == "ENT 101" and "Welcome to Entrepreneurship" in [((i.get("draft") or i.get("published") or {}).get("title")) for i in fac.get(f"/api/teach/offerings/{o['id']}/items")]
           for o in offerings):
        raise SystemExit("Already seeded (found the first lesson).")
    students = {e: Api(e) for e in ("student1@example.com", "student2@example.com", "student3@example.com", "cara@example.com")}
    random.seed(7)
    past = []                      # work that closed already: published open, then its deadline is moved back
    for off in offerings:
        code, oid = off["subject"]["code"], off["id"]
        spec = SPEC.get(code)
        if not spec or off["term_status"] != "open":
            continue
        T = f"/api/teach/offerings/{oid}"
        L = f"/api/learn/offerings/{oid}"
        print(f"== {code} {off['subject']['title']} ({off['term']})")
        # hide the clutter (kept in the database; nothing is deleted)
        for it in fac.get(f"{T}/items"):
            if not it.get("archived"):
                fac.patch(f"{T}/items/{it['id']}", {"archived": True})
        for a in fac.get(f"{T}/assessments"):
            if not a.get("archived"):
                fac.patch(f"{T}/assessments/{a['id']}", {"archived": True})
        # the syllabus
        topics, chapters = [], []
        for title, weeks, tps in spec["chapters"]:
            tlist = [{"id": uid(), "title": t[0]} for t in tps]
            chapters.append({"id": uid(), "title": title, "weeks": weeks, "topics": tlist})
            topics.append(tlist)
        outline = {"course": {"name": off["subject"]["title"], "code": code, "units": "3"},
                   "outcomes": [{"id": uid(), "text": o} for o in spec["outcomes"]], "chapters": chapters}
        draft = fac.post(f"{T}/syllabus/draft")
        saved = fac.put(f"{T}/syllabus/draft", {"expected_counter": draft["counter"], "outline": outline, "grading_policy": POLICY})
        fac.post(f"{T}/syllabus/draft/publish", {"expected_counter": saved["counter"]})
        # lessons
        lessons = []
        for ci, (_, _, tps) in enumerate(spec["chapters"]):
            for ti, (_, ls) in enumerate(tps):
                node = chapters[ci]["topics"][ti]["id"]
                for title, intro, pts in ls:
                    item = fac.post(f"{T}/items", {"kind": "lesson", "title": title})
                    d = fac.get(f"{T}/items/{item['id']}")["draft"]
                    s = fac.put(f"{T}/items/{item['id']}/draft", {"expected_counter": d["counter"], "title": title, "body_html": html(intro, pts, TIPS[len(lessons) % len(TIPS)]), "anchor_node_id": node})
                    fac.post(f"{T}/items/{item['id']}/draft/publish", {"expected_counter": s["counter"]})
                    lessons.append(item["id"])
        # assessments
        def publish(kind, title, **fields):
            aid = fac.post(f"{T}/assessments", {"kind": kind, "title": title})["id"]
            counter = fac.get(f"{T}/assessments/{aid}")["draft"]["counter"]
            body = {"expected_counter": counter, "title": title, "instructions": "", "allow_late": False, "max_attempts": 1,
                    "score_rule": "highest", "include_in_grade": True, **fields}
            saved = fac.put(f"{T}/assessments/{aid}/draft", body)
            fac.post(f"{T}/assessments/{aid}/draft/publish", {"expected_counter": saved["counter"]})
            return aid
        quizzes, acts = [], []
        for title, period, _, qs in spec["quizzes"]:
            aid = publish("online_quiz", title, category_key="quiz", period=period, max_points="0", questions=qs,
                          deadline=hours(48 if period == "midterm" else 200), instructions="Answer every question. One attempt.")
            quizzes.append((aid, qs, period))
            if period == "midterm":
                past.append(aid)
        for title, period, pts, due, instr in spec["activities"]:
            aid = publish("activity", title, category_key="activity", period=period, max_points=str(pts), deadline=hours(48 if due < 0 else due), instructions=instr, requires_file=True)
            acts.append((aid, period, due))
            if due < 0:
                past.append(aid)
        exam_id = publish("exam", spec["exam"][0], category_key="exam", period="midterm", max_points=str(spec["exam"][1]), instructions="Closed notes.")
        for title, body in spec["announcements"]:
            a = fac.post(f"{T}/announcements", {"title": title, "body": body, "section_ids": []})
            fac.post(f"{T}/announcements/{a['id']}/publish")
        # students at different paces
        pace = dict(zip(students, (len(lessons), int(len(lessons) * .75), int(len(lessons) * .5), int(len(lessons) * .6))))
        skill = dict(zip(students, (.95, .8, .65, .85)))
        member = {e: oid in {x["offering_id"] for x in st.get("/api/me/subjects") if x["enrollment_status"] == "enrolled"} for e, st in students.items()}
        for email, st in students.items():
            if not member[email]:
                continue
            for lid in lessons[:pace[email]]:
                st.raw_post(f"{L}/lessons/{lid}/complete")
            for aid, qs, period in quizzes:
                if period != "midterm":
                    continue
                started = st.raw_post(f"{L}/assessments/{aid}/attempts")
                if started.status_code >= 300:
                    print("   skipped an attempt:", started.status_code)
                    continue
                attempt = started.json()
                answers = {}
                for q in qs:
                    right = random.random() < skill[email]
                    if q["type"] == "multiple_choice":
                        answers[q["key"]] = q["correct"] if right else next(c["id"] for c in q["choices"] if c["id"] != q["correct"])
                    elif q["type"] == "true_false":
                        answers[q["key"]] = q["correct"] if right else (not q["correct"])
                    else:
                        answers[q["key"]] = q["correct"][0] if right else "not sure"
                st.raw_post(f"{L}/attempts/{attempt['id']}/submit", {"idempotency_key": uid(), "answers": answers})
            for aid, period, due in acts:
                if period == "midterm" and email != "student3@example.com":
                    st.upload(f"{L}/assessments/{aid}/submissions", "reflection.pdf", PDF, {"note": "Here is my work. Thank you!"})
        # scores and release
        for aid, period, due in acts:
            if period != "midterm":
                continue
            rows = fac.get(f"{T}/assessments/{aid}/scores")
            for r in rows:
                if r.get("latest") or r.get("versions"):
                    fac.put(f"{T}/assessments/{aid}/scores/{r['student_id']}", {"score": random.choice([38, 42, 44, 46, 48, 50]), "feedback": "Clear and honest. Keep going."})
            fac.post(f"{T}/assessments/{aid}/release", {"student_ids": None})
        for r in fac.get(f"{T}/assessments/{exam_id}/scores"):
            fac.put(f"{T}/assessments/{exam_id}/scores/{r['student_id']}", {"score": random.randint(72, 96)})
        fac.post(f"{T}/assessments/{exam_id}/release", {"student_ids": None})
        for aid, qs, period in quizzes:
            if period == "midterm":
                fac.post(f"{T}/assessments/{aid}/release", {"student_ids": None})
        r = fac.raw_post(f"{T}/grades/publish", {"period": "midterm"})
        print("   midterm grades:", r.status_code)

    # variety for the activity line, and a quiet bell
    db = SessionLocal()
    try:
        db.execute(text("UPDATE assessment_revision SET deadline = now() - interval '4 days' WHERE assessment_id = ANY(CAST(:ids AS uuid[]))"), {"ids": "{" + ",".join(past) + "}"})
        db.execute(text("UPDATE learning_event SET occurred_at = now() - (random() * interval '6 days')"))
        db.execute(text("UPDATE notification SET read_at = now() WHERE read_at IS NULL"))
        db.commit()
    finally:
        db.close()
    print("Showcase ready.")


if __name__ == "__main__":
    main()
