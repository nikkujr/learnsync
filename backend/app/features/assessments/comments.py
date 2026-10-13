"""Private comments between one student and the teacher about one assessment. Each side is told when the other writes."""
from sqlalchemy import select

from app.errors import fail
from app.features.accounts.models import Account
from app.features.notifications import service as notifications

from .models import AssessmentComment
from .scores import targeted_students

MAX_LENGTH = 2000


def thread(db, assessment_id, student_id):
    rows = db.execute(select(AssessmentComment, Account.display_name, Account.role)
                      .join(Account, Account.id == AssessmentComment.author_id)
                      .where(AssessmentComment.assessment_id == assessment_id, AssessmentComment.student_id == student_id)
                      .order_by(AssessmentComment.created_at)).all()
    return [{"id": c.id, "author": name, "role": role, "body": c.body, "at": c.created_at} for c, name, role in rows]


def _add(db, assessment, student_id, author, body):
    body = body.strip()
    if not body:
        fail(422, "comment_empty", "Write something first.")
    db.add(AssessmentComment(assessment_id=assessment.id, student_id=student_id, author_id=author.id, body=body[:MAX_LENGTH]))


def student_says(db, student, offering, assessment, title, body):
    _add(db, assessment, student.id, student, body)
    notifications.notify(db, [offering.faculty_id], "comment", f"{student.display_name} commented on {title}",
                         f"/faculty/offerings/{offering.id}/assessments/{assessment.id}/scores",
                         offering, notifications.subject_code(db, offering))
    db.commit()
    return thread(db, assessment.id, student.id)


def teacher_says(db, actor, offering, assessment, title, student_id, body):
    if student_id not in {a.id for _, a in targeted_students(db, offering, assessment)}:
        fail(422, "student_invalid", "Choose a currently enrolled student this applies to.")
    _add(db, assessment, student_id, actor, body)
    notifications.notify(db, [student_id], "comment", f"Your teacher commented on {title}",
                         f"/student/offerings/{offering.id}/work/{assessment.id}", offering,
                         notifications.subject_code(db, offering))
    db.commit()
    return thread(db, assessment.id, student_id)
