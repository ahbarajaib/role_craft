# Use official slim Python runtime
FROM python:3.12-slim

# Prevent interactive prompts during apt-get package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies (LibreOffice for PDF rendering + basic tools)
ENV CACHEBUST=20260729_02
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-writer \
    fonts-liberation \
    curl \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install project dependencies using uv and download Playwright Chromium with dependencies
RUN uv sync --frozen --no-cache && \
    uv run playwright install --with-deps chromium

# Copy application source code
COPY app/ app/
COPY main.py main.py

# Create directories for sqlite data and file uploads
RUN mkdir -p /app/data /app/uploads

# Set runtime environment paths and configurations
ENV PATH="/app/.venv/bin:$PATH"
ENV UPLOAD_DIR="/app/uploads"
ENV DATABASE_FILE="/app/data/rolecraft.db"
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Expose FastAPI server port
EXPOSE 8000

# Execute server on startup
CMD ["python", "main.py"]
