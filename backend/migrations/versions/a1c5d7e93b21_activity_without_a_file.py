"""Activities can be turned in without a file (requires_file; submission file is optional)"""
from alembic import op
import sqlalchemy as sa
revision = 'a1c5d7e93b21'
down_revision = '29f75f29e858'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('assessment_revision', sa.Column('requires_file', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column('activity_submission', 'file_id', existing_type=sa.UUID(), nullable=True)


def downgrade():
    op.execute("DELETE FROM activity_submission WHERE file_id IS NULL")
    op.alter_column('activity_submission', 'file_id', existing_type=sa.UUID(), nullable=False)
    op.drop_column('assessment_revision', 'requires_file')
