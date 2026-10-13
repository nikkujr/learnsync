import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.features.accounts.models import now


class Notification(Base):
    """One in-app notice for one person: something was assigned, returned, published or said. The link opens the thing."""
    __tablename__ = "notification"
    __table_args__ = (Index("notification_recipient_recent", "recipient_id", "created_at"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("account.id"))
    offering_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("offering.id"))
    kind: Mapped[str] = mapped_column(String(24))
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(String(300), default="")
    link: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
