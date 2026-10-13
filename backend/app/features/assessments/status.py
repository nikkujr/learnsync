"""How many students are where on one published assessment: the Turned in / Assigned / Graded counts a teacher sees on a
Classwork row and on the assignment page. Descriptive only; the student work page holds the exact per-student state."""
from sqlalchemy import select

from .models import ActivitySubmission, AssessmentScore, QuizAttempt, ResultPublication
from .scores import targeted_students


def counts(db, offering, assessment):
    ids = {account.id for _, account in targeted_students(db, offering, assessment)}
    released = set(db.scalars(select(ResultPublication.student_id).where(
        ResultPublication.assessment_id == assessment.id))) & ids
    scored = set(db.scalars(select(AssessmentScore.student_id).where(
        AssessmentScore.assessment_id == assessment.id, AssessmentScore.score.is_not(None)))) & ids
    excused = set(db.scalars(select(AssessmentScore.student_id).where(
        AssessmentScore.assessment_id == assessment.id, AssessmentScore.excused.is_(True)))) & ids
    submitted = set()
    if assessment.kind == "activity":
        submitted = set(db.scalars(select(ActivitySubmission.student_id).where(
            ActivitySubmission.assessment_id == assessment.id, ActivitySubmission.withdrawn_at.is_(None)))) & ids
    elif assessment.kind == "online_quiz":
        submitted = set(db.scalars(select(QuizAttempt.student_id).where(
            QuizAttempt.assessment_id == assessment.id, QuizAttempt.state == "submitted"))) & ids
    return {"total": len(ids), "graded": len(released), "turned_in": len(submitted - released),
            "assigned": len(ids - submitted - released - scored - excused),
            "to_return": len(scored - released - excused), "excused": len(excused)}
