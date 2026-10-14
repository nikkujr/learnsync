import uuid

from helpers import Api, make_account
from test_activities import rows, score, submit_pdf
from test_assessments import a, iso, la, make_manual


def mine(who):
    return who.get("/api/me/notifications").json()


def titles(who, kind=None):
    return [n["title"] for n in mine(who)["items"] if kind is None or n["kind"] == kind]


def test_assigning_submitting_and_returning_tell_the_right_people(graded):
    fac, st1, st2 = graded["fac"], graded["st1"], graded["st2"]
    before = mine(st1)["unread"]
    aid = make_manual(graded, "activity", "Notice me", points="10", category_key="activity", deadline=iso(24))
    assert any("Notice me" in t for t in titles(st1, "assigned")) and any("Notice me" in t for t in titles(st2, "assigned"))
    assert mine(st1)["unread"] == before + 1
    assert not any("Notice me" in t for t in titles(fac))                          # the teacher is not told about their own post
    link = next(n["link"] for n in mine(st1)["items"] if "Notice me" in n["title"])
    assert link.endswith(f"/work/{aid}")
    assert submit_pdf(st1, graded, aid).status_code == 201
    assert any(t.endswith("turned in Notice me") for t in titles(fac, "turned_in"))
    assert score(graded, aid, graded["students"][0], 9).status_code == 200
    assert not any("returned" in t.lower() for t in titles(st1, "returned"))        # a score alone tells the student nothing
    assert fac.post(a(graded, f"/{aid}/release"), {"student_ids": None}).status_code == 200
    assert any("Notice me" in t for t in titles(st1, "returned"))
    assert titles(st2, "returned") == []                                           # only the student whose result was returned


def test_a_scheduled_assessment_is_announced_only_once_it_exists_for_students(graded):
    st1 = graded["st1"]
    make_manual(graded, "activity", "Next week", points="10", category_key="activity", available_from=iso(24 * 7), deadline=iso(24 * 9))
    assert not any("Next week" in t for t in titles(st1))


def test_notifications_are_private_and_can_be_marked_read(graded):
    st1, st2 = graded["st1"], graded["st2"]
    make_manual(graded, "activity", "Read me", points="10", category_key="activity")
    first = mine(st1)["items"][0]
    assert st2.post("/api/me/notifications/read", {"ids": [first["id"]]}).status_code == 204     # someone else's id does nothing
    assert mine(st1)["unread"] >= 1 and not mine(st1)["items"][0]["read"]
    assert st1.post("/api/me/notifications/read", {"ids": [first["id"]]}).status_code == 204
    assert mine(st1)["items"][0]["read"] is True
    assert st1.post("/api/me/notifications/read", {}).status_code == 204
    assert mine(st1)["unread"] == 0


def test_private_comments_pass_between_one_student_and_the_teacher_only(db, graded):
    fac, st1, st2 = graded["fac"], graded["st1"], graded["st2"]
    s1 = graded["students"][0]
    aid = make_manual(graded, "activity", "Talk about it", points="10", category_key="activity", deadline=iso(24))
    learn = la(graded, f"/assessments/{aid}/comments")
    teach = a(graded, f"/{aid}/comments/{s1.id}")
    assert st1.post(learn, {"body": "Is a draft enough?"}).status_code == 201
    assert any("commented on Talk about it" in t for t in titles(fac, "comment"))
    assert [c["body"] for c in fac.get(teach).json()] == ["Is a draft enough?"]
    reply = fac.post(teach, {"body": "Yes, send it."})
    assert reply.status_code == 201 and [c["role"] for c in reply.json()] == ["student", "faculty"]
    assert any("Your teacher commented" in t for t in titles(st1, "comment"))
    assert [c["body"] for c in st1.get(learn).json()] == ["Is a draft enough?", "Yes, send it."]
    assert st2.get(learn).json() == []                                              # another student sees their own (empty) thread
    assert st1.post(learn, {"body": "   "}).status_code == 422 and st1.post(learn, {"body": ""}).status_code == 422
    other = Api(make_account(db, "comment-other@example.com", "faculty").email)
    assert other.get(teach).status_code in (403, 404) and other.post(teach, {"body": "hi"}).status_code in (403, 404)
    assert fac.post(a(graded, f"/{aid}/comments/{uuid.uuid4()}"), {"body": "x"}).status_code == 422          # not a student of this class


def test_a_student_can_take_a_turn_in_back_until_it_is_graded(graded):
    st1 = graded["st1"]
    s1 = graded["students"][0]
    aid = make_manual(graded, "activity", "Take it back", points="10", category_key="activity", deadline=iso(24))
    item = lambda: next(i for i in st1.get(la(graded, "/assessments")).json() if i["id"] == aid)
    assert submit_pdf(st1, graded, aid).status_code == 201
    assert item()["can_unsubmit"] is True and item()["state"] == "resubmit"
    assert st1.post(la(graded, f"/assessments/{aid}/unsubmit")).status_code == 204
    assert item()["state"] == "available" and item()["submissions"] == [] and item()["can_unsubmit"] is False
    assert rows(graded, aid)["s1"]["latest"] is None and rows(graded, aid)["s1"]["versions"] == 0   # the teacher sees nothing turned in
    assert st1.post(la(graded, f"/assessments/{aid}/unsubmit")).json()["error"]["code"] == "nothing_to_unsubmit"
    again = submit_pdf(st1, graded, aid)
    assert again.status_code == 201 and again.json()["version"] == 2                             # the withdrawn version is kept in the history
    assert score(graded, aid, s1, 7).status_code == 200
    assert item()["can_unsubmit"] is False
    assert st1.post(la(graded, f"/assessments/{aid}/unsubmit")).json()["error"]["code"] == "already_graded"
    # marking done can also be taken back and done again
    done = make_manual(graded, "activity", "Done twice", points="10", category_key="activity", requires_file=False, deadline=iso(24))
    assert st1.post(la(graded, f"/assessments/{done}/mark-done"), {}).status_code == 201
    assert st1.post(la(graded, f"/assessments/{done}/unsubmit")).status_code == 204
    assert st1.post(la(graded, f"/assessments/{done}/mark-done"), {}).status_code == 201


def test_administrators_are_told_about_new_reports(world):
    admin, student = Api("admin@example.com"), Api("s1@example.com")
    before = mine(admin)["unread"]
    assert student.post("/api/issues", {"type": "bug", "title": "Blank page", "description": "Nothing shows when I open it."}).status_code == 201
    assert any(t == "New report: Blank page" for t in titles(admin, "report"))
    assert mine(admin)["unread"] == before + 1
    assert titles(student, "report") == []
