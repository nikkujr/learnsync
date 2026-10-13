"""A teacher can excuse a student from an assessment (assessment_score.excused)"""
from alembic import op
import sqlalchemy as sa
revision = 'b3d9e1f27a44'
down_revision = 'a1c5d7e93b21'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('assessment_score', sa.Column('excused', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('assessment_score', 'excused')
