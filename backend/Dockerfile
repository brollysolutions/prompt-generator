# Stage 1: build wheels (needs a compiler toolchain)
FROM python:3.13-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install into an isolated prefix we can copy into the slim runtime image.
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: slim runtime (no compiler toolchain in the final image)
FROM python:3.13-slim AS runtime

WORKDIR /app

# Copy the installed packages + console scripts (gunicorn, uvicorn) from the builder.
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create a non-root user, create data directory, and give ownership of the app directory
RUN mkdir -p /app/data && \
    adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port 8000
EXPOSE 8000

# Liveness check used by Docker / compose healthchecks
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run via Gunicorn. Worker count is overridable via WEB_CONCURRENCY (SQLite + high
# worker counts can contend on writes; tune to the container's CPU allocation).
CMD ["sh", "-c", "gunicorn main:app --workers ${WEB_CONCURRENCY:-4} --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --forwarded-allow-ips '*' --timeout 120 --keep-alive 5"]
