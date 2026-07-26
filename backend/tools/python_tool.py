import sys
import io
import time
import traceback
import contextlib
import pandas as pd
import numpy as np
import json
from typing import Dict, Any, Optional
import plotly
import plotly.graph_objects as go
import plotly.express as px


# Safe builtins that are allowed in sandboxed execution
SAFE_BUILTINS = {
    "print": print,
    "len": len,
    "range": range,
    "enumerate": enumerate,
    "zip": zip,
    "list": list,
    "dict": dict,
    "set": set,
    "tuple": tuple,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "round": round,
    "abs": abs,
    "min": min,
    "max": max,
    "sum": sum,
    "sorted": sorted,
    "reversed": reversed,
    "map": map,
    "filter": filter,
    "any": any,
    "all": all,
    "type": type,
    "isinstance": isinstance,
    "hasattr": hasattr,
    "getattr": getattr,
    "format": format,
    "__import__": __import__,
}

BLOCKED_KEYWORDS = [
    "os.system", "subprocess", "shutil.rmtree", "open(",
    "__subclasses__", "eval(", "compile(", "exec(",
    "importlib", "socket", "requests.delete", "requests.put",
]


class PythonTool:
    """Sandboxed Python execution tool."""

    def is_safe(self, code: str) -> Dict[str, Any]:
        """Check if generated code is safe to execute."""
        for kw in BLOCKED_KEYWORDS:
            if kw in code:
                return {"safe": False, "reason": f"Blocked keyword found: {kw}"}
        return {"safe": True}

    def execute(self, code: str, dataset_path: str, file_type: str) -> Dict[str, Any]:
        """Execute Python code in a sandboxed environment with dataset loaded."""
        start = time.time()

        # Safety check
        safety = self.is_safe(code)
        if not safety["safe"]:
            return {
                "success": False,
                "error": f"Unsafe code detected: {safety['reason']}",
                "execution_time": 0,
            }

        # Load dataset
        try:
            if file_type in ("csv", "txt"):
                df = pd.read_csv(dataset_path)
            elif file_type in ("xlsx", "xls", "excel"):
                df = pd.read_excel(dataset_path)
            elif file_type in ("sqlite", "db"):
                import sqlite3
                conn = sqlite3.connect(dataset_path)
                tables = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table'", conn)
                df = pd.read_sql(f"SELECT * FROM {tables['name'][0]}", conn)
                conn.close()
            else:
                df = pd.read_csv(dataset_path)
        except Exception as e:
            return {"success": False, "error": f"Failed to load dataset: {e}", "execution_time": 0}

        # Capture stdout
        stdout_capture = io.StringIO()
        chart_data = None

        # Execution namespace
        namespace = {
            "__builtins__": SAFE_BUILTINS,
            "pd": pd,
            "pandas": pd,
            "np": np,
            "numpy": np,
            "go": go,
            "px": px,
            "plotly": plotly,
            "df": df,
            "fig": None,
        }

        try:
            with contextlib.redirect_stdout(stdout_capture):
                exec(compile(code, "<analyst>", "exec"), namespace)

            execution_time = time.time() - start

            # Check if a plotly figure was created
            fig = namespace.get("fig")
            if fig is not None and isinstance(fig, go.Figure):
                chart_data = json.loads(fig.to_json())

            stdout = stdout_capture.getvalue()

            return {
                "success": True,
                "stdout": stdout,
                "chart_data": chart_data,
                "execution_time": round(execution_time, 3),
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
                "execution_time": round(time.time() - start, 3),
            }


python_tool = PythonTool()
