import os
import pandas as pd
import pytest
from backend.tools.sql_tool import SQLTool
from backend.tools.python_tool import PythonTool
from backend.tools.stats_tool import StatsTool
from backend.tools.chart_tool import ChartTool

SAMPLE_CSV = "uploads/sample_sales.csv"

def test_sql_tool_load_and_execute():
    sql_tool = SQLTool()
    conn, table_name = sql_tool.load_dataset(SAMPLE_CSV, "csv")
    assert conn is not None
    assert table_name is not None

    res = sql_tool.execute_sql("SELECT category, SUM(sales) as total_sales FROM {table} GROUP BY category", SAMPLE_CSV, "csv")
    assert res["success"] is True
    assert "total_sales" in res["columns"]
    assert len(res["rows"]) > 0

def test_sql_tool_schema():
    sql_tool = SQLTool()
    schema_res = sql_tool.get_schema(SAMPLE_CSV, "csv")
    assert "table_name" in schema_res
    assert "schema" in schema_res
    assert schema_res["row_count"] == 20

def test_python_tool_execute():
    python_tool = PythonTool()
    code = "print(df['sales'].sum())"
    res = python_tool.execute(code, SAMPLE_CSV, "csv")
    assert res["success"] is True
    assert "stdout" in res

def test_python_tool_blocked_keyword():
    python_tool = PythonTool()
    code = "import os; os.system('echo test')"
    res = python_tool.execute(code, SAMPLE_CSV, "csv")
    assert res["success"] is False
    assert "Unsafe code" in res["error"]

def test_stats_tool():
    stats_tool = StatsTool()
    df = pd.read_csv(SAMPLE_CSV)
    data = df.to_dict(orient="records")
    res = stats_tool.full_stats(data)
    assert res["success"] is True
    assert "sales" in res["stats"]
    assert res["stats"]["sales"]["count"] == 20

def test_chart_tool():
    df = pd.read_csv(SAMPLE_CSV)
    data = df.to_dict(orient="records")
    chart_tool = ChartTool()
    chart_type = chart_tool.auto_detect_chart_type("Plot total sales by category", ["category", "sales"], data)
    assert chart_type == "bar"

    res = chart_tool.generate_chart(chart_type, data, x_col="category", y_col="sales", title="Sales by Category")
    assert res["success"] is True
    assert res["chart_type"] == "bar"
    assert "chart_json" in res
