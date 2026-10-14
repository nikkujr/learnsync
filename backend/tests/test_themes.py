from helpers import Api, make_account


def test_the_teacher_picks_a_class_look_and_the_class_sees_it(course):
    fac, st1, st2, oid = course["fac"], course["st1"], course["st2"], course["oid"]
    assert fac.get("/api/me/class-themes").json() == {}
    assert fac.put(f"/api/teach/offerings/{oid}/theme", {"color": 3, "art": 4}).json() == {"color": 3, "art": 4}
    assert fac.get("/api/me/class-themes").json() == {oid: {"color": 3, "art": 4}}
    assert st1.get("/api/me/class-themes").json() == {oid: {"color": 3, "art": 4}}          # an enrolled student sees it
    assert Api("admin@example.com").get("/api/me/class-themes").json() == {oid: {"color": 3, "art": 4}}
    assert fac.put(f"/api/teach/offerings/{oid}/theme", {"color": 3, "art": None}).json()["art"] is None
    assert fac.put(f"/api/teach/offerings/{oid}/theme", {"color": None, "art": None}).status_code == 200
    assert fac.get("/api/me/class-themes").json() == {}                                     # back to the derived look


def test_only_the_classs_own_teacher_may_choose_and_only_offered_looks(db, course):
    oid = course["oid"]
    fac, st1 = course["fac"], course["st1"]
    assert fac.put(f"/api/teach/offerings/{oid}/theme", {"color": 10}).status_code == 422
    assert fac.put(f"/api/teach/offerings/{oid}/theme", {"art": -1}).status_code == 422
    assert st1.put(f"/api/teach/offerings/{oid}/theme", {"color": 1}).status_code == 403
    other = Api(make_account(db, "other-teacher@example.com", "faculty").email)
    assert other.put(f"/api/teach/offerings/{oid}/theme", {"color": 1}).status_code == 404
    assert other.get("/api/me/class-themes").json() == {}
