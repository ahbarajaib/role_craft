# Use official slim Python runtime
FROM python:3.12-slim

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies (LibreOffice for PDF rendering + Playwright Chromium dependencies)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
    curl \
    wget \
    gnupg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    librandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/* || true

# Set working directory inside container
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install project dependencies using uv and download Playwright Chromium
RUN uv sync --frozen --no-cache && \
    uv run playwright install chromium || true

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
