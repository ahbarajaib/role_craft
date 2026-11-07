import os

# Ensure tests run with clean test environment and no external Sentry calls
os.environ["ENVIRONMENT"] = "test"
os.environ["SENTRY_DSN"] = ""
