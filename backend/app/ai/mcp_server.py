"""INGAMAR BI - MCP (Model Context Protocol) Server
Exposes INGAMAR's data tools to AI assistants (Claude, etc.)
Run: python -m app.ai.mcp_server
"""
import os
import sys
import json
import asyncio

# Add parent dir to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from sqlalchemy import create_engine, text, inspect
import pandas as pd

DB_URI = os.environ.get("INGAMAR_DB_URI", "sqlite:///ingamar.db")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

engine = create_engine(DB_URI)
server = Server("ingamar-bi")

TOOLS = [
    Tool(
        name="list_datasets",
        description="List all available datasets (tables) in the INGAMAR database. Returns table names, row counts, and column counts.",
        inputSchema={"type": "object", "properties": {}, "required": []},
    ),
    Tool(
        name="get_dataset_schema",
        description="Get the full schema (column names and types) for a dataset. Use this before writing SQL queries.",
        inputSchema={
            "type": "object",
            "properties": {"table_name": {"type": "string", "description": "Name of the table"}},
            "required": ["table_name"],
        },
    ),
    Tool(
        name="get_dataset_stats",
        description="Get detailed statistics for each column in a dataset: min, max, avg, unique counts, null counts, top values.",
        inputSchema={
            "type": "object",
            "properties": {"table_name": {"type": "string", "description": "Name of the table"}},
            "required": ["table_name"],
        },
    ),
    Tool(
        name="query_data",
        description="Execute a SELECT SQL query on the INGAMAR database. Returns the results as JSON. Only SELECT queries are allowed.",
        inputSchema={
            "type": "object",
            "properties": {"sql": {"type": "string", "description": "A SELECT SQL query to execute"}},
            "required": ["sql"],
        },
    ),
    Tool(
        name="natural_language_query",
        description="Ask a question about the data in natural language. The AI will generate and execute a SQL query, returning results with a chart recommendation. Use this when the user asks analytical questions.",
        inputSchema={
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "The analytical question to ask about the data"},
                "table_name": {"type": "string", "description": "The table to query against"},
            },
            "required": ["question", "table_name"],
        },
    ),
    Tool(
        name="preview_data",
        description="Preview the first N rows of a dataset. Useful for understanding the data before querying.",
        inputSchema={
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "Name of the table"},
                "limit": {"type": "integer", "description": "Number of rows to return (default 10)"},
            },
            "required": ["table_name"],
        },
    ),
]

@server.list_tools()
async def list_tools():
    return TOOLS

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    try:
        if name == "list_datasets":
            return await _list_datasets()
        elif name == "get_dataset_schema":
            return await _get_schema(arguments["table_name"])
        elif name == "get_dataset_stats":
            return await _get_stats(arguments["table_name"])
        elif name == "query_data":
            return await _query_data(arguments["sql"])
        elif name == "natural_language_query":
            return await _nl_query(arguments["question"], arguments["table_name"])
        elif name == "preview_data":
            limit = arguments.get("limit", 10)
            return await _preview(arguments["table_name"], limit)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]

async def _list_datasets():
    insp = inspect(engine)
    datasets = []
    for table in insp.get_table_names():
        if table.startswith(("kaggle_", "user_")):
            with engine.connect() as conn:
                count = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
            cols = len(insp.get_columns(table))
            datasets.append({"name": table, "rows": count, "columns": cols})
    return [TextContent(type="text", text=json.dumps(datasets, indent=2))]

async def _get_schema(table_name: str):
    insp = inspect(engine)
    columns = [{"name": c["name"], "type": str(c["type"])} for c in insp.get_columns(table_name)]
    return [TextContent(type="text", text=json.dumps(columns, indent=2))]

async def _get_stats(table_name: str):
    df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
    stats = {}
    for col in df.columns:
        col_stats = {"type": str(df[col].dtype), "nulls": int(df[col].isna().sum()), "unique": int(df[col].nunique())}
        if pd.api.types.is_numeric_dtype(df[col]):
            col_stats["min"] = float(df[col].min()) if pd.notna(df[col].min()) else None
            col_stats["max"] = float(df[col].max()) if pd.notna(df[col].max()) else None
            col_stats["avg"] = round(float(df[col].mean()), 2) if pd.notna(df[col].mean()) else None
        else:
            top = df[col].value_counts().head(5).to_dict()
            col_stats["top_values"] = {str(k): int(v) for k, v in top.items()}
        stats[col] = col_stats
    return [TextContent(type="text", text=json.dumps(stats, indent=2))]

async def _query_data(sql: str):
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        return [TextContent(type="text", text="Error: Only SELECT queries are allowed")]
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        rows = [dict(row._mapping) for row in result.fetchall()]
    return [TextContent(type="text", text=json.dumps(rows, default=str, indent=2))]

async def _nl_query(question: str, table_name: str):
    if not GROQ_API_KEY:
        return [TextContent(type="text", text="Error: GROQ_API_KEY not set")]
    try:
        from app.ai.groq_service import run_ai_query
        result = run_ai_query(question, table_name, table_name)
        return [TextContent(type="text", text=json.dumps(result, default=str, indent=2))]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]

async def _preview(table_name: str, limit: int):
    df = pd.read_sql(f'SELECT * FROM "{table_name}" LIMIT {limit}', engine)
    df = df.where(pd.notna(df), None)
    result = {"columns": df.columns.tolist(), "data": df.to_dict(orient="records"), "total_rows": len(df)}
    return [TextContent(type="text", text=json.dumps(result, default=str, indent=2))]

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
