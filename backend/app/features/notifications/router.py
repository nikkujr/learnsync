from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import current_account

from . import service

router = APIRouter(prefix="/api/me/notifications", tags=["Notifications"])


class ReadInput(BaseModel):
    ids: list[UUID] | None = Field(default=None, max_length=100)     # none = everything


@router.get("")
def my_notifications(actor=Depends(current_account), db: Session = Depends(get_db)):
    return service.recent(db, actor)


@router.post("/read", status_code=204)
def mark_my_notifications_read(data: ReadInput, actor=Depends(current_account), db: Session = Depends(get_db)):
    service.mark_read(db, actor, data.ids)
