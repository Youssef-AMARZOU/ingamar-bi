import os
import json
import re
import pandas as pd
from groq import Groq
from sqlalchemy import text, inspect
from app import db

SYSTEM_PROMPT = """You are an expert data analyst AI embedded in a BI dashboard (INGAMAR).
You have access to real database tables with full schema, statistics, and sample data.

When the user asks a question, you MUST:
1. Understand the question using the schema and statistics provided
2. Generate a valid PostgreSQL SQL query
3. Recommend the best chart type for the result

Respond ONLY in this exact JSON format:
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
- Use aggregations (SUM, COUNT, AVG, MAX, MIN) when appropriate
- For time series, ORDER BY the date column
- x_column must be a category or date, y_columns must be numeric
- Use double quotes for table/column names
- Use actual column names from the schema provided
- Reference the statistics to give accurate, data-driven explanations
- Do not add LIMIT unless specifically requested by the user
- If the question is ambiguous, make the most useful interpretation"""

def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set. Add it to your .env or Hugging Face Space secrets.")
    return Groq(api_key=api_key)

def get_rag_context(dataset_id: str) -> dict:
    """Build rich RAG context: schema, statistics, sample data, distributions."""
    try:
        engine = db.engine
        inspector = inspect(engine)
        columns = inspector.get_columns(dataset_id)

        # Get total row count
        with engine.connect() as conn:
            total_rows = conn.execute(text(f'SELECT COUNT(*) FROM "{dataset_id}"')).scalar()

        # Build schema info with types
        schema = []
        for col in columns:
            schema.append({
                "name": col["name"],
                "type": str(col["type"]),
            })

        # Get sample rows (3)
        sample = pd.read_sql(f'SELECT * FROM "{dataset_id}" LIMIT 3', engine)
        sample_str = sample.to_dict(orient="records") if not sample.empty else []

        # Get column statistics
        stats = {}
        for col in columns:
            col_name = col["name"]
            col_type = str(col["type"]).lower()
            try:
                if any(t in col_type for t in ["int", "float", "double", "numeric", "decimal", "real"]):
                    # Numeric column stats
                    result = pd.read_sql(f"""
                        SELECT
                            COUNT("{col_name}") as cnt,
                            COUNT(DISTINCT "{col_name}") as unique_cnt,
                            MIN("{col_name}") as min_val,
                            MAX("{col_name}") as max_val,
                            AVG("{col_name}") as avg_val,
                            SUM(CASE WHEN "{col_name}" IS NULL THEN 1 ELSE 0 END) as null_cnt
                        FROM "{dataset_id}"
                    """, engine)
                    row = result.iloc[0]
                    stats[col_name] = {
                        "type": "numeric",
                        "count": int(row["cnt"]),
                        "unique": int(row["unique_cnt"]),
                        "min": float(row["min_val"]) if pd.notna(row["min_val"]) else None,
                        "max": float(row["max_val"]) if pd.notna(row["max_val"]) else None,
                        "avg": round(float(row["avg_val"]), 2) if pd.notna(row["avg_val"]) else None,
                        "nulls": int(row["null_cnt"]),
                    }
                else:
                    # Categorical column stats
                    result = pd.read_sql(f"""
                        SELECT
                            COUNT("{col_name}") as cnt,
                            COUNT(DISTINCT "{col_name}") as unique_cnt,
                            SUM(CASE WHEN "{col_name}" IS NULL THEN 1 ELSE 0 END) as null_cnt
                        FROM "{dataset_id}"
                    """, engine)
                    row = result.iloc[0]
                    top_vals = pd.read_sql(f"""
                        SELECT "{col_name}" as val, COUNT(*) as freq
                        FROM "{dataset_id}"
                        WHERE "{col_name}" IS NOT NULL
                        GROUP BY "{col_name}"
                        ORDER BY freq DESC
                        LIMIT 5
                    """, engine)
                    stats[col_name] = {
                        "type": "categorical",
                        "count": int(row["cnt"]),
                        "unique": int(row["unique_cnt"]),
                        "nulls": int(row["null_cnt"]),
                        "top_values": [{"value": str(r["val"]), "freq": int(r["freq"])} for _, r in top_vals.iterrows()],
                    }
            except Exception:
                continue

        return {
            "table_name": dataset_id,
            "total_rows": total_rows,
            "columns": schema,
            "statistics": stats,
            "sample_rows": sample_str,
        }
    except Exception as e:
        return {"error": str(e)}

def ask_groq(question: str, dataset_id: str, table_name: str) -> dict:
    client = get_groq_client()
    rag_context = get_rag_context(dataset_id)

    user_message = f"""Database table: `{table_name}`
RAG Context (schema + statistics + sample data):
{json.dumps(rag_context, indent=2)}

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
