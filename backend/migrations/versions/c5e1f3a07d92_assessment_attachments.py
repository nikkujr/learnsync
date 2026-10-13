"""Teachers can attach files and links to assignments (assessment_attachment)"""
from alembic import op
import sqlalchemy as sa
revision = 'c5e1f3a07d92'
down_revision = 'b3d9e1f27a44'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('assessment_attachment',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('revision_id', sa.UUID(), nullable=False),
        sa.Column('kind', sa.String(length=8), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('file_id', sa.UUID(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('file','link')", name='attachment_kind'),
        sa.ForeignKeyConstraint(['file_id'], ['stored_file.id']),
        sa.ForeignKeyConstraint(['revision_id'], ['assessment_revision.id']),
        sa.PrimaryKeyConstraint('id'))
    op.create_index(op.f('ix_assessment_attachment_revision_id'), 'assessment_attachment', ['revision_id'])


def downgrade():
    op.drop_index(op.f('ix_assessment_attachment_revision_id'), table_name='assessment_attachment')
    op.drop_table('assessment_attachment')
