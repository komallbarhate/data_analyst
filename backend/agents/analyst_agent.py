"""
AI Data Analyst Agent — LangGraph state machine
Nodes: planner → executor (sql/python/stats) → verifier → chart → insight → response
"""
import json
import time
import traceback
from typing import TypedDict, Optional, List, Dict, Any, Literal
from langgraph.graph import StateGraph, END
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.llm import llm_client
from tools.sql_tool import sql_tool
from tools.python_tool import python_tool
from tools.chart_tool import chart_tool
from tools.stats_tool import stats_tool


# ─── Agent State ──────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    # Input
    question: str
    dataset_path: str
    file_type: str
    table_name: str
    schema: Dict[str, str]
    sample_data: List[Dict]
    conversation_history: List[Dict]  # previous messages for context

    # Planning
    plan: Dict[str, Any]            # LLM plan output
    tool_to_use: str                # "sql" | "python" | "stats" | "chart" | "insight"
    needs_chart: bool

    # Execution
    generated_code: Optional[str]
    sql_verified: bool
    execution_result: Optional[Dict[str, Any]]
    retry_count: int
    error_message: Optional[str]

    # Chart
    chart_data: Optional[Dict[str, Any]]
    chart_type: Optional[str]

    # Output
    table_data: Optional[List[Dict]]
    table_columns: Optional[List[str]]
    insight: Optional[str]
    reasoning_trace: List[Dict[str, str]]
    final_answer: str
    execution_time: float


# ─── Helper: build schema prompt ─────────────────────────────────────────────

def build_schema_context(state: AgentState) -> str:
    schema_lines = [f"  - {col}: {dtype}" for col, dtype in state["schema"].items()]
    schema_str = "\n".join(schema_lines)
    sample_str = json.dumps(state["sample_data"][:3], indent=2, default=str)
    return f"""Dataset: {state['table_name']}
Columns:
{schema_str}

Sample data (first 3 rows):
{sample_str}"""


def build_history_context(state: AgentState) -> str:
    if not state.get("conversation_history"):
        return ""
    lines = []
    for msg in state["conversation_history"][-6:]:  # last 3 turns
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content'][:300]}")
    return "\n".join(lines)


# ─── Node 1: Planner ─────────────────────────────────────────────────────────

def planner_node(state: AgentState) -> AgentState:
    """Decide which tool to use and generate the code."""
    state["reasoning_trace"].append({
        "step": "🧠 Planning",
        "detail": "Analyzing question and deciding which tool to use..."
    })

    schema_ctx = build_schema_context(state)
    history_ctx = build_history_context(state)

    system_prompt = """You are an expert data analyst AI. Given a dataset schema and user question, decide the best approach and generate the code.

You must respond with a JSON object following this exact structure:
{
  "tool": "sql" | "python" | "stats" | "insight_only",
  "needs_chart": true | false,
  "chart_type": "bar" | "line" | "pie" | "scatter" | "histogram" | "heatmap" | "box" | null,
  "reasoning": "brief explanation of why you chose this approach",
  "code": "the generated SQL query or Python code",
  "chart_x_col": "column name for x axis or null",
  "chart_y_col": "column name for y axis or null"
}

Rules:
- Use "sql" for aggregations, filtering, grouping, counting, averages, rankings.
- Use "python" for plotting, machine learning, complex transformations, predictions.
- Use "stats" for descriptive statistics, anomaly detection, correlation analysis.
- Use "insight_only" for questions that can be answered from sample data alone.
- For SQL, use DuckDB syntax. The table name is {table_name}. Use double quotes around table name.
- For Python, df is already loaded as a pandas DataFrame. Create a plotly figure and assign to 'fig' variable.
- Always set needs_chart=true if the user asks to plot/visualize/chart/graph/show trends.
- If needs_chart=true and tool=sql, generate SQL that returns data suitable for charting."""

    user_msg = f"""{schema_ctx}

Previous conversation:
{history_ctx}

User question: {state['question']}

Table name for SQL: "{state['table_name']}" """

    try:
        plan = llm_client.chat_json([
            {"role": "system", "content": system_prompt.replace("{table_name}", state["table_name"])},
            {"role": "user", "content": user_msg},
        ])

        state["plan"] = plan
        state["tool_to_use"] = plan.get("tool", "sql")
        state["needs_chart"] = plan.get("needs_chart", False)
        state["chart_type"] = plan.get("chart_type")
        state["generated_code"] = plan.get("code", "")

        state["reasoning_trace"].append({
            "step": f"📋 Tool Selected: {state['tool_to_use'].upper()}",
            "detail": plan.get("reasoning", "")
        })

    except Exception as e:
        state["tool_to_use"] = "sql"
        state["generated_code"] = f'SELECT * FROM "{state["table_name"]}" LIMIT 10'
        state["needs_chart"] = False
        state["reasoning_trace"].append({
            "step": "⚠️ Planning fallback",
            "detail": f"Error in planning: {str(e)}. Falling back to basic SQL."
        })

    return state


# ─── Node 2: Verifier ─────────────────────────────────────────────────────────

def verifier_node(state: AgentState) -> AgentState:
    """Verify generated SQL or Python code before execution."""
    tool = state["tool_to_use"]
    code = state.get("generated_code", "")

    state["reasoning_trace"].append({
        "step": "🔍 Verifying Code",
        "detail": f"Checking {tool.upper()} code for errors..."
    })

    if tool == "sql":
        result = sql_tool.verify_sql(code, state["dataset_path"], state["file_type"])
        if result.get("valid"):
            state["sql_verified"] = True
            state["reasoning_trace"].append({
                "step": "✅ SQL Verified",
                "detail": "SQL syntax is valid."
            })
        else:
            state["sql_verified"] = False
            state["error_message"] = result.get("error", "Unknown SQL error")
            state["reasoning_trace"].append({
                "step": "❌ SQL Verification Failed",
                "detail": state["error_message"]
            })

    elif tool == "python":
        safety = python_tool.is_safe(code)
        state["sql_verified"] = safety["safe"]
        if not safety["safe"]:
            state["error_message"] = f"Unsafe code: {safety.get('reason')}"
            state["reasoning_trace"].append({
                "step": "🚫 Code Safety Check Failed",
                "detail": state["error_message"]
            })
        else:
            state["reasoning_trace"].append({
                "step": "✅ Python Code Safe",
                "detail": "Code passed safety checks."
            })
    else:
        state["sql_verified"] = True

    return state


# ─── Node 2b: Code Fixer (retry on verify failure) ───────────────────────────

def code_fixer_node(state: AgentState) -> AgentState:
    """Ask LLM to fix broken code."""
    state["retry_count"] = state.get("retry_count", 0) + 1
    state["reasoning_trace"].append({
        "step": f"🔧 Fixing Code (attempt {state['retry_count']})",
        "detail": f"Error: {state.get('error_message')}. Asking AI to fix..."
    })

    schema_ctx = build_schema_context(state)

    messages = [
        {
            "role": "system",
            "content": f"""You are fixing a broken {state['tool_to_use'].upper()} query/code.
Return ONLY a JSON object: {{"code": "fixed code here", "explanation": "what was wrong"}}
Table name: "{state['table_name']}"
{schema_ctx}"""
        },
        {
            "role": "user",
            "content": f"""Original code:
{state['generated_code']}

Error:
{state.get('error_message', 'Unknown error')}

Fix the code."""
        }
    ]

    try:
        fix = llm_client.chat_json(messages)
        state["generated_code"] = fix.get("code", state["generated_code"])
        state["reasoning_trace"].append({
            "step": "🔧 Code Fixed",
            "detail": fix.get("explanation", "")
        })
    except Exception as e:
        state["reasoning_trace"].append({
            "step": "⚠️ Fix Failed",
            "detail": str(e)
        })

    return state


# ─── Node 3: Executor ─────────────────────────────────────────────────────────

def executor_node(state: AgentState) -> AgentState:
    """Execute the verified code."""
    tool = state["tool_to_use"]
    code = state.get("generated_code", "")

    state["reasoning_trace"].append({
        "step": f"⚡ Executing {tool.upper()}",
        "detail": f"Running: {code[:100]}{'...' if len(code) > 100 else ''}"
    })

    start = time.time()

    if tool == "sql":
        result = sql_tool.execute_sql(code, state["dataset_path"], state["file_type"])
        state["execution_result"] = result
        if result.get("success"):
            state["table_data"] = result.get("rows", [])
            state["table_columns"] = result.get("columns", [])
            state["execution_time"] = result.get("execution_time", 0)
            state["reasoning_trace"].append({
                "step": "📊 SQL Result",
                "detail": f"Returned {result.get('total_rows', 0)} rows in {result.get('execution_time', 0):.3f}s"
            })
        else:
            state["error_message"] = result.get("error", "SQL execution failed")
            state["reasoning_trace"].append({
                "step": "❌ SQL Execution Failed",
                "detail": state["error_message"]
            })

    elif tool == "python":
        result = python_tool.execute(code, state["dataset_path"], state["file_type"])
        state["execution_result"] = result
        if result.get("success"):
            state["execution_time"] = result.get("execution_time", 0)
            if result.get("chart_data"):
                state["chart_data"] = result["chart_data"]
                state["needs_chart"] = False  # already has chart from python
            state["reasoning_trace"].append({
                "step": "🐍 Python Executed",
                "detail": f"Completed in {result.get('execution_time', 0):.3f}s"
            })
        else:
            state["error_message"] = result.get("error", "Python execution failed")
            state["reasoning_trace"].append({
                "step": "❌ Python Execution Failed",
                "detail": state["error_message"]
            })

    elif tool == "stats":
        result = stats_tool.full_stats(state["sample_data"])
        state["execution_result"] = result
        if result.get("success"):
            state["table_data"] = [
                {"metric": k, **v}
                for k, v in result.get("stats", {}).items()
            ]
            state["table_columns"] = ["metric", "count", "mean", "std", "min", "median", "max", "trend_direction"]
            state["execution_time"] = round(time.time() - start, 3)
        state["reasoning_trace"].append({
            "step": "📈 Statistics Computed",
            "detail": f"Analyzed {len(result.get('stats', {}))} numeric columns"
        })

    else:  # insight_only
        state["execution_result"] = {"success": True, "data": state["sample_data"]}
        state["table_data"] = state["sample_data"][:10]
        state["execution_time"] = 0

    return state


# ─── Node 4: Chart Generator ──────────────────────────────────────────────────

def chart_node(state: AgentState) -> AgentState:
    """Generate chart from SQL/stats results if needed."""
    if not state.get("needs_chart") or not state.get("table_data"):
        return state

    state["reasoning_trace"].append({
        "step": "📉 Generating Chart",
        "detail": f"Creating {state.get('chart_type', 'bar')} chart..."
    })

    plan = state.get("plan", {})
    chart_result = chart_tool.generate_chart(
        chart_type=state.get("chart_type") or "bar",
        data=state["table_data"],
        x_col=plan.get("chart_x_col"),
        y_col=plan.get("chart_y_col"),
        title=state["question"],
    )

    if chart_result.get("success"):
        state["chart_data"] = chart_result
        state["reasoning_trace"].append({
            "step": "✅ Chart Ready",
            "detail": f"{chart_result.get('chart_type', '').capitalize()} chart generated"
        })
    else:
        state["reasoning_trace"].append({
            "step": "⚠️ Chart Failed",
            "detail": chart_result.get("error", "Unknown chart error")
        })

    return state


# ─── Node 5: Insight Generator ────────────────────────────────────────────────

def insight_node(state: AgentState) -> AgentState:
    """Generate plain English insight from results."""
    state["reasoning_trace"].append({
        "step": "💡 Generating Insight",
        "detail": "AI is writing a plain English explanation..."
    })

    # Build context for insight
    exec_result = state.get("execution_result", {})
    table_preview = json.dumps(state.get("table_data", [])[:5], indent=2, default=str)
    error_info = state.get("error_message", "")

    if error_info:
        state["insight"] = f"I encountered an error while processing your question: {error_info}"
        state["final_answer"] = state["insight"]
        return state

    system_prompt = """You are a friendly, expert data analyst. Given query results, write a clear, insightful explanation in 2-4 sentences.
- Highlight key findings (biggest values, trends, anomalies)
- Use specific numbers from the data
- Be conversational but professional
- Do NOT mention SQL, Python, or technical details
- If there's a chart, mention what it shows"""

    user_msg = f"""User asked: "{state['question']}"

Results (first 5 rows):
{table_preview}

Tool used: {state.get('tool_to_use', 'N/A')}
Rows returned: {len(state.get('table_data', []))}
Has chart: {bool(state.get('chart_data'))}

Write a clear, insightful explanation of these results."""

    try:
        insight = llm_client.chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ], temperature=0.3)

        state["insight"] = insight.strip()
        state["final_answer"] = insight.strip()
        state["reasoning_trace"].append({
            "step": "✅ Insight Generated",
            "detail": "Analysis complete."
        })
    except Exception as e:
        state["insight"] = "Analysis complete. Results are shown in the table above."
        state["final_answer"] = state["insight"]

    return state


# ─── Routing Logic ────────────────────────────────────────────────────────────

def route_after_plan(state: AgentState) -> str:
    return "verify"


def route_after_verify(state: AgentState) -> str:
    if not state.get("sql_verified", True):
        if state.get("retry_count", 0) < 2:
            return "fix"
        return "insight"  # give up after 2 retries
    return "execute"


def route_after_execute(state: AgentState) -> str:
    if state.get("error_message") and not state.get("table_data"):
        if state.get("retry_count", 0) < 2:
            # Re-verify to re-fix
            state["sql_verified"] = False
            return "fix"
    return "chart"


def route_after_chart(state: AgentState) -> str:
    return "insight"


# ─── Build Graph ──────────────────────────────────────────────────────────────

def build_analyst_agent():
    graph = StateGraph(AgentState)

    graph.add_node("plan", planner_node)
    graph.add_node("verify", verifier_node)
    graph.add_node("fix", code_fixer_node)
    graph.add_node("execute", executor_node)
    graph.add_node("chart", chart_node)
    graph.add_node("insight", insight_node)

    graph.set_entry_point("plan")

    graph.add_edge("plan", "verify")
    graph.add_conditional_edges("verify", route_after_verify, {
        "fix": "fix",
        "execute": "execute",
        "insight": "insight",
    })
    graph.add_edge("fix", "verify")
    graph.add_conditional_edges("execute", route_after_execute, {
        "fix": "fix",
        "chart": "chart",
    })
    graph.add_edge("chart", "insight")
    graph.add_edge("insight", END)

    return graph.compile()


# Singleton agent
analyst_agent = build_analyst_agent()


def run_agent(
    question: str,
    dataset_path: str,
    file_type: str,
    schema: Dict[str, str],
    sample_data: List[Dict],
    table_name: str,
    conversation_history: List[Dict] = None,
) -> Dict[str, Any]:
    """Run the analyst agent and return structured results."""
    initial_state: AgentState = {
        "question": question,
        "dataset_path": dataset_path,
        "file_type": file_type,
        "table_name": table_name,
        "schema": schema,
        "sample_data": sample_data,
        "conversation_history": conversation_history or [],
        "plan": {},
        "tool_to_use": "sql",
        "needs_chart": False,
        "generated_code": None,
        "sql_verified": False,
        "execution_result": None,
        "retry_count": 0,
        "error_message": None,
        "chart_data": None,
        "chart_type": None,
        "table_data": None,
        "table_columns": None,
        "insight": None,
        "reasoning_trace": [],
        "final_answer": "",
        "execution_time": 0.0,
    }

    try:
        final_state = analyst_agent.invoke(initial_state)
        return {
            "success": True,
            "tool_used": final_state.get("tool_to_use"),
            "generated_code": final_state.get("generated_code"),
            "table_data": final_state.get("table_data"),
            "table_columns": final_state.get("table_columns"),
            "chart_data": final_state.get("chart_data"),
            "insight": final_state.get("insight"),
            "final_answer": final_state.get("final_answer"),
            "reasoning_trace": final_state.get("reasoning_trace", []),
            "execution_time": final_state.get("execution_time", 0),
            "error": final_state.get("error_message"),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "reasoning_trace": [{"step": "❌ Agent Error", "detail": traceback.format_exc()}],
        }
