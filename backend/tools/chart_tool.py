import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import json
import base64
from typing import Dict, Any, List, Optional


CHART_TYPE_MAP = {
    "bar": "bar",
    "line": "line",
    "pie": "pie",
    "scatter": "scatter",
    "histogram": "histogram",
    "heatmap": "heatmap",
    "box": "box",
    "area": "area",
}


class ChartTool:
    """Plotly-based chart generation tool."""

    def auto_detect_chart_type(self, question: str, columns: List[str], data: List[Dict]) -> str:
        """Simple heuristic to detect the best chart type."""
        q = question.lower()
        if any(w in q for w in ["trend", "over time", "monthly", "weekly", "daily", "line"]):
            return "line"
        if any(w in q for w in ["distribution", "histogram", "spread"]):
            return "histogram"
        if any(w in q for w in ["proportion", "share", "percentage", "pie"]):
            return "pie"
        if any(w in q for w in ["scatter", "correlation", "relationship"]):
            return "scatter"
        if any(w in q for w in ["heatmap", "matrix", "correlation matrix"]):
            return "heatmap"
        if any(w in q for w in ["box", "quartile", "outlier", "whisker"]):
            return "box"
        return "bar"  # default

    def generate_chart(
        self,
        chart_type: str,
        data: List[Dict[str, Any]],
        x_col: Optional[str] = None,
        y_col: Optional[str] = None,
        title: str = "",
        color_col: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a Plotly chart and return JSON + base64 PNG."""
        try:
            df = pd.DataFrame(data)
            if df.empty:
                return {"error": "No data to chart"}

            # Auto-detect columns if not specified
            if not x_col and len(df.columns) >= 1:
                x_col = df.columns[0]
            if not y_col and len(df.columns) >= 2:
                # Find numeric column for y
                numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
                if numeric_cols:
                    y_col = numeric_cols[0]
                else:
                    y_col = df.columns[1]

            chart_type = CHART_TYPE_MAP.get(chart_type, "bar")

            # Light theme layout
            layout_theme = dict(
                template="plotly_white",
                paper_bgcolor="#ffffff",
                plot_bgcolor="#f8fafc",
                font=dict(family="Inter, sans-serif", color="#0f172a"),
                title=dict(text=title, font=dict(size=18, color="#6d28d9")),
                margin=dict(l=60, r=30, t=60, b=60),
                colorway=["#7c3aed", "#0284c7", "#059669", "#d97706", "#dc2626", "#ec4899"],
            )

            fig = None

            if chart_type == "bar":
                fig = px.bar(df, x=x_col, y=y_col, title=title, color=color_col,
                             color_discrete_sequence=["#8b5cf6", "#06b6d4", "#10b981"])
            elif chart_type == "line":
                fig = px.line(df, x=x_col, y=y_col, title=title, markers=True)
            elif chart_type == "pie":
                fig = px.pie(df, names=x_col, values=y_col, title=title)
            elif chart_type == "scatter":
                fig = px.scatter(df, x=x_col, y=y_col, title=title, color=color_col)
            elif chart_type == "histogram":
                fig = px.histogram(df, x=x_col or y_col, title=title, nbins=30)
            elif chart_type == "heatmap":
                numeric_df = df.select_dtypes(include=["number"])
                corr = numeric_df.corr()
                fig = px.imshow(corr, title=title, color_continuous_scale="Viridis")
            elif chart_type == "box":
                fig = px.box(df, x=x_col, y=y_col, title=title, color=color_col)
            elif chart_type == "area":
                fig = px.area(df, x=x_col, y=y_col, title=title)
            else:
                fig = px.bar(df, x=x_col, y=y_col, title=title)

            fig.update_layout(**layout_theme)

            chart_json = json.loads(fig.to_json())

            # Generate PNG
            try:
                png_bytes = fig.to_image(format="png", width=900, height=500, scale=2)
                png_b64 = base64.b64encode(png_bytes).decode("utf-8")
            except Exception:
                png_b64 = None

            return {
                "success": True,
                "chart_type": chart_type,
                "chart_json": chart_json,
                "png_base64": png_b64,
                "x_col": x_col,
                "y_col": y_col,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


chart_tool = ChartTool()
