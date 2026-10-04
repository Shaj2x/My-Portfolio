FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY marq_analytics ./marq_analytics
USER nobody
EXPOSE 8000
CMD ["uvicorn", "marq_analytics.api:app", "--host", "0.0.0.0", "--port", "8000"]
