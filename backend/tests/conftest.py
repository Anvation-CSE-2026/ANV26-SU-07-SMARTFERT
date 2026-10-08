import os

# Keep automated test runs off the real st01.db file - every test session gets
# its own clean in-memory database. Must be set before `app`/`st01.db` import.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
