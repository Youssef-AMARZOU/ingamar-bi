import os
import json
import re
import pandas as pd
from groq import Groq
from sqlalchemy import text, inspect
from app import db

SYSTEM_PROMPT = """You are an expert data analyst AI embedded in a BI dashboard.
Given a user question and the database schema, you must:
1. Generate a valid PostgreSQL SQL query
2. Recommend the best chart type for the result

Respond ONLY in this exact JSON format, nothing else:
{
  "sql": "SELECT ...",
  "chart_type": "bar|line|pie|scatter|area",
  "x_column": "column_name",
  "y_columns": ["column_name"],
  "title": "Chart title",
  "explanation": "One sentence explaining what this shows"
}

Rules:
- SQL must be SELECT only, never INSERT/UPDATE/DELETE/DROP
- Do not add LIMIT unless specifically requested
- Use aggregations (SUM, COUNT, AVG) when appropriate
- For time series, ORDER BY the date column
- x_column must be a category or date, y_columns must be numeric
- Use double quotes for table/column names
- Use actual column names from the schema provided"""

def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set. Add it to your .env or Hugging Face Space secrets.")
    return Groq(api_key=api_key)

def get_schema_context(dataset_id: str) -> str:
    try:
        engine = db.engine
        inspector = inspect(engine)
        columns = inspector.get_columns(dataset_id)
        lines = []
        for col in columns:
            lines.append(f"  - {col['name']} ({col['type']})")
        # Get a sample row
        sample = pd.read_sql(f'SELECT * FROM "{dataset_id}" LIMIT 3', engine)
        sample_str = sample.to_string() if not sample.empty else "(empty)"
        return f"Columns:\n" + "\n".join(lines) + f"\n\nSample rows:\n{sample_str}"
    except Exception as e:
        return f"Schema not available: {e}"

def ask_groq(question: str, dataset_id: str, table_name: str) -> dict:
    client = get_groq_client()
    schema = get_schema_context(dataset_id)

    user_message = f"""Database table: `{table_name}`
Schema for `{dataset_id}`:
{schema}

User question: {question}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ],
        temperature=0.1,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"```json|```", "", raw).strip()
    return json.loads(raw)

def run_ai_query(question: str, dataset_id: str, table_name: str) -> dict:
    ai_response = ask_groq(question, dataset_id, table_name)

    sql = ai_response["sql"].strip()
    if not sql.upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    engine = db.engine
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        rows = result.fetchall()
        columns = list(result.keys())
        data = [dict(zip(columns, row)) for row in rows]

    return {
        "sql": sql,
        "data": data,
        "columns": columns,
        "chart_type": ai_response.get("chart_type", "bar"),
        "x_column": ai_response.get("x_column", columns[0] if columns else ""),
        "y_columns": ai_response.get("y_columns", columns[1:2] if len(columns) > 1 else columns[:1]),
        "title": ai_response.get("title", "AI Query Result"),
        "explanation": ai_response.get("explanation", ""),
        "total_rows": len(data),
    }
