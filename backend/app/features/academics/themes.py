"""A class's look: the teacher may pick its banner colour and header drawing; everyone in the class sees it."""
from sqlalchemy import select

from app.errors import fail
from app.features.teaching.access import teaching_offering

from .models import Enrollment, Offering

COLORS, ARTS = 10, 6          # how many the front end offers; keep in step with components/classes.tsx


def visible(db, account):
    """{offering id: {color, art}} for the classes this person teaches, is in, or (admin) all, where a look was chosen."""
    if account.role == "faculty":
        query = select(Offering).where(Offering.faculty_id == account.id)
    elif account.role == "student":
        query = select(Offering).join(Enrollment, Enrollment.offering_id == Offering.id).where(Enrollment.student_id == account.id)
    else:
        query = select(Offering)
    return {str(o.id): {"color": o.theme_color, "art": o.theme_art} for o in db.scalars(query)
            if o.theme_color is not None or o.theme_art is not None}


def choose(db, actor, offering_id, color, art):
    offering = teaching_offering(db, offering_id, actor, write=False)      # a closed term may still be re-coloured
    if color is not None and not 0 <= color < COLORS or art is not None and not 0 <= art < ARTS:
        fail(422, "theme_invalid", "Choose one of the offered colours and drawings.")
    offering.theme_color, offering.theme_art = color, art
    db.commit()
    return {"color": color, "art": art}
