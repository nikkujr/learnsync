"""The teacher's pick of banner colour and header drawing for a class"""
from alembic import op
import sqlalchemy as sa
revision = 'e1b4c6d8f203'
down_revision = 'd7a2b8c4e611'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('offering', sa.Column('theme_color', sa.SmallInteger(), nullable=True))
    op.add_column('offering', sa.Column('theme_art', sa.SmallInteger(), nullable=True))


def downgrade():
    op.drop_column('offering', 'theme_art')
    op.drop_column('offering', 'theme_color')
