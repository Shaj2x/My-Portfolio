FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY marq_sim ./marq_sim
USER nobody
ENTRYPOINT ["python", "-m", "marq_sim"]
CMD ["live", "--drive-shuttle"]
