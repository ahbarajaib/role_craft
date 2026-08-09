# Use official slim Python runtime
FROM python:3.12-slim

# Prevent interactive prompts during apt-get package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies (LibreOffice for PDF rendering + font suites)
ENV CACHEBUST=20260807_02
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-common \
    default-jre-headless \
    fonts-carlito \
    fonts-caladea \
    fonts-liberation \
    fonts-opensymbol \
    fonts-dejavu \
    fonts-freefont-ttf \
    fontconfig \
    curl \
    wget \
    gnupg \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install project dependencies using uv and download Playwright Chromium with dependencies
RUN uv sync --frozen --no-cache && \
    uv run playwright install --with-deps chromium

# Copy application source code & custom Microsoft TTF font suite (Aptos, Calibri, Arial, Times, Georgia, Cambria, Century Gothic)
COPY app/ app/
COPY main.py main.py
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    cp -r app/fonts/* /usr/share/fonts/truetype/custom/ && \
    fc-cache -fv

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
