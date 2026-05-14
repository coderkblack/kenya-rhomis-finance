FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API source and artifacts
COPY api/ /app/
COPY artifacts_kenya/ /app/artifacts_kenya/

ENV ARTIFACTS_DIR=/app/artifacts_kenya

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
