"""Writing and reading notifications. Callers add notices inside their own transaction (no commit here), so a notice exists
exactly when the thing it announces was saved."""
from sqlalchemy import func, select, update

from app.features.academics.models import Enrollment, Subject
from app.features.accounts.models import now
from app.features.teaching.access import targeted

from .models import Notification


def subject_code(db, offering):
    return db.scalar(select(Subject.code).where(Subject.id == offering.subject_id)) or ""


def notify(db, recipient_ids, kind, title, link, offering=None, detail=""):
    for rid in dict.fromkeys(recipient_ids):
        db.add(Notification(recipient_id=rid, offering_id=offering.id if offering else None, kind=kind,
                            title=title[:200], detail=detail[:300], link=link[:300]))


def notify_students(db, offering, section_ids, kind, title, link):
    """Every currently enrolled student the item is for (an empty section list means everyone)."""
    ids = [e.student_id for e in db.scalars(select(Enrollment).where(
        Enrollment.offering_id == offering.id, Enrollment.status == "enrolled")) if targeted(set(section_ids), e)]
    notify(db, ids, kind, title, link, offering, subject_code(db, offering))


def recent(db, account, limit=30):
    rows = db.scalars(select(Notification).where(Notification.recipient_id == account.id)
                      .order_by(Notification.created_at.desc()).limit(limit)).all()
    unread = db.scalar(select(func.count()).select_from(Notification).where(
        Notification.recipient_id == account.id, Notification.read_at.is_(None))) or 0
    return {"unread": unread, "items": [{"id": n.id, "kind": n.kind, "title": n.title, "detail": n.detail,
                                         "link": n.link, "at": n.created_at, "read": n.read_at is not None} for n in rows]}


def mark_read(db, account, ids):
    query = update(Notification).where(Notification.recipient_id == account.id, Notification.read_at.is_(None))
    if ids is not None:
        query = query.where(Notification.id.in_(list(ids)))
    db.execute(query.values(read_at=now()))
    db.commit()
