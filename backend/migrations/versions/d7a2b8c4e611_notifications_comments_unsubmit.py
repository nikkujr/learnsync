"""In-app notifications, private assessment comments, and withdrawn (unsubmitted) submissions"""
from alembic import op
import sqlalchemy as sa
revision = 'd7a2b8c4e611'
down_revision = 'c5e1f3a07d92'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('notification',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('offering_id', sa.UUID(), nullable=True),
        sa.Column('kind', sa.String(length=24), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('detail', sa.String(length=300), nullable=False),
        sa.Column('link', sa.String(length=300), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['offering_id'], ['offering.id']),
        sa.ForeignKeyConstraint(['recipient_id'], ['account.id']),
        sa.PrimaryKeyConstraint('id'))
    op.create_index('notification_recipient_recent', 'notification', ['recipient_id', 'created_at'])
    op.create_table('assessment_comment',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('assessment_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('author_id', sa.UUID(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessment.id']),
        sa.ForeignKeyConstraint(['author_id'], ['account.id']),
        sa.ForeignKeyConstraint(['student_id'], ['account.id']),
        sa.PrimaryKeyConstraint('id'))
    op.create_index(op.f('ix_assessment_comment_assessment_id'), 'assessment_comment', ['assessment_id'])
    op.create_index(op.f('ix_assessment_comment_student_id'), 'assessment_comment', ['student_id'])
    op.add_column('activity_submission', sa.Column('withdrawn_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('activity_submission', 'withdrawn_at')
    op.drop_index(op.f('ix_assessment_comment_student_id'), table_name='assessment_comment')
    op.drop_index(op.f('ix_assessment_comment_assessment_id'), table_name='assessment_comment')
    op.drop_table('assessment_comment')
    op.drop_index('notification_recipient_recent', table_name='notification')
    op.drop_table('notification')
