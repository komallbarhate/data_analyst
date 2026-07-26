import duckdb
import pandas as pd
import json
import time
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings


class SQLTool:
    """DuckDB-powered SQL execution tool for uploaded datasets."""

    def load_dataset(self, filepath: str, file_type: str) -> Tuple[duckdb.DuckDBPyConnection, str]:
        """Load a dataset into DuckDB and return connection + table name."""
        conn = duckdb.connect(database=":memory:")
        table_name = Path(filepath).stem.lower().replace(" ", "_").replace("-", "_")
        # Sanitize table name
        import re
        table_name = re.sub(r'[^a-z0-9_]', '_', table_name)
        if table_name[0].isdigit():
            table_name = "t_" + table_name

        if file_type in ("csv", "txt"):
            conn.execute(f"""
                CREATE TABLE "{table_name}" AS
                SELECT * FROM read_csv_auto('{filepath}', header=true, sample_size=-1)
            """)
        elif file_type in ("xlsx", "xls", "excel"):
            df = pd.read_excel(filepath)
            conn.register(table_name, df)
        elif file_type in ("sqlite", "db"):
            # Attach the SQLite file and copy tables
            conn.execute(f"ATTACH '{filepath}' AS src_db (TYPE SQLITE)")
            tables = conn.execute("SELECT name FROM src_db.sqlite_master WHERE type='table'").fetchall()
            if tables:
                table_name = tables[0][0]
            conn.execute(f"DETACH src_db")
            # Re-read via pandas sqlite
            import sqlite3
            src_conn = sqlite3.connect(filepath)
            df = pd.read_sql(f"SELECT * FROM {table_name}", src_conn)
            src_conn.close()
            conn.register(table_name, df)

        return conn, table_name

    def get_schema(self, filepath: str, file_type: str) -> Dict[str, Any]:
        """Get schema and sample data from a dataset file."""
        try:
            conn, table_name = self.load_dataset(filepath, file_type)
            schema_result = conn.execute(f"DESCRIBE \"{table_name}\"").fetchall()
            schema = {row[0]: row[1] for row in schema_result}

            sample = conn.execute(f'SELECT * FROM "{table_name}" LIMIT 5').fetchdf()
            row_count = conn.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
            col_count = len(schema)
            conn.close()

            return {
                "table_name": table_name,
                "schema": schema,
                "sample": sample.to_dict(orient="records"),
                "row_count": row_count,
                "col_count": col_count,
            }
        except Exception as e:
            return {"error": str(e)}

    def execute_sql(
        self,
        sql: str,
        filepath: str,
        file_type: str,
        max_rows: int = 500
    ) -> Dict[str, Any]:
        """Execute SQL on the dataset and return structured results."""
        start = time.time()
        try:
            conn, table_name = self.load_dataset(filepath, file_type)

            # Replace any placeholder table names with actual table name
            sql_to_run = sql.replace("{table}", table_name).replace("{TABLE}", table_name)

            result_df = conn.execute(sql_to_run).fetchdf()
            execution_time = time.time() - start
            conn.close()

            total_rows = len(result_df)
            display_df = result_df.head(max_rows)

            return {
                "success": True,
                "table_name": table_name,
                "columns": list(display_df.columns),
                "rows": display_df.to_dict(orient="records"),
                "total_rows": total_rows,
                "execution_time": round(execution_time, 3),
                "sql_executed": sql_to_run,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time": round(time.time() - start, 3),
            }

    def verify_sql(self, sql: str, filepath: str, file_type: str) -> Dict[str, Any]:
        """Verify SQL syntax without fully executing (EXPLAIN)."""
        try:
            conn, table_name = self.load_dataset(filepath, file_type)
            sql_to_check = sql.replace("{table}", table_name).replace("{TABLE}", table_name)
            conn.execute(f"EXPLAIN {sql_to_check}")
            conn.close()
            return {"valid": True}
        except Exception as e:
            return {"valid": False, "error": str(e)}


sql_tool = SQLTool()
