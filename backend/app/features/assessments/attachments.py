"""Files and links a teacher attaches to an assignment. They belong to a revision: editing happens on the draft, publishing
makes them visible with the rest of that version, and a new draft starts from a copy."""
from pydantic import AnyHttpUrl, TypeAdapter, ValidationError
from sqlalchemy import func, select

from app.errors import fail
from app.features.accounts.commands import audit
from app.features.files.models import StoredFile
from app.features.files.storage import save_upload

from .models import AssessmentAttachment, AssessmentRevision

ATTACHMENT_TYPES = {".pdf", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg"}
MAX_ATTACHMENTS = 10


def listing(db, rev):
    out = []
    for row in db.scalars(select(AssessmentAttachment).where(AssessmentAttachment.revision_id == rev.id)
                          .order_by(AssessmentAttachment.position, AssessmentAttachment.created_at)):
        file = db.get(StoredFile, row.file_id) if row.file_id else None
        out.append({"id": row.id, "kind": row.kind, "title": row.title, "url": row.url,
                    "file": {"id": file.id, "name": file.original_name, "size": file.size} if file else None})
    return out


def copy(db, from_revision_id, to_revision_id):
    """A new draft starts with the attachments of the version it came from (the same stored files, not new copies)."""
    for row in db.scalars(select(AssessmentAttachment).where(AssessmentAttachment.revision_id == from_revision_id)
                          .order_by(AssessmentAttachment.position)):
        db.add(AssessmentAttachment(revision_id=to_revision_id, kind=row.kind, title=row.title, url=row.url,
                                    file_id=row.file_id, position=row.position))


def draft_of(db, assessment):
    draft = db.scalar(select(AssessmentRevision).where(
        AssessmentRevision.assessment_id == assessment.id, AssessmentRevision.state == "draft"))
    if not draft:
        fail(409, "no_draft", "Start editing first: there is no draft to attach to.")
    if (db.scalar(select(func.count()).select_from(AssessmentAttachment)
                  .where(AssessmentAttachment.revision_id == draft.id)) or 0) >= MAX_ATTACHMENTS:
        fail(422, "too_many_attachments", f"An assignment can have at most {MAX_ATTACHMENTS} attachments.")
    return draft


def next_position(db, revision_id):
    return (db.scalar(select(func.max(AssessmentAttachment.position)).where(
        AssessmentAttachment.revision_id == revision_id)) or 0) + 1


def add_file(db, actor, assessment, upload, title):
    draft = draft_of(db, assessment)
    file = save_upload(db, upload, "assessment_attachment", actor, ATTACHMENT_TYPES)
    row = AssessmentAttachment(revision_id=draft.id, kind="file", file_id=file.id, position=next_position(db, draft.id),
                               title=(title.strip() or file.original_name)[:200])
    db.add(row)
    audit(db, actor, "assessment.attachment_added", "assessment", assessment.id, {"kind": "file"})
    db.commit()
    return listing(db, draft)


def add_link(db, actor, assessment, title, url):
    draft = draft_of(db, assessment)
    try:
        TypeAdapter(AnyHttpUrl).validate_python(url)
    except ValidationError:
        fail(422, "link_invalid", "Enter a valid web address starting with http:// or https://.")
    db.add(AssessmentAttachment(revision_id=draft.id, kind="link", url=url, position=next_position(db, draft.id),
                                title=(title.strip() or url)[:200]))
    audit(db, actor, "assessment.attachment_added", "assessment", assessment.id, {"kind": "link"})
    db.commit()
    return listing(db, draft)


def remove(db, actor, assessment, attachment_id):
    """Removes it from the DRAFT only; a published version keeps what students saw (the stored file is never deleted)."""
    draft = db.scalar(select(AssessmentRevision).where(
        AssessmentRevision.assessment_id == assessment.id, AssessmentRevision.state == "draft"))
    row = db.get(AssessmentAttachment, attachment_id)
    if not draft or not row or row.revision_id != draft.id:
        fail(404, "not_found", "Attachment not found on the draft.")
    db.delete(row)
    audit(db, actor, "assessment.attachment_removed", "assessment", assessment.id, {})
    db.commit()
    return listing(db, draft)
