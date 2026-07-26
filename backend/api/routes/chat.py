import json
import os
import sys
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database.models import get_db, Dataset, ChatSession, Message, QueryHistory
from models.schemas import ChatRequest, ChatResponse, ReasoningStep
from agents.analyst_agent import run_agent

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Main chat endpoint — runs the analyst agent."""
    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Get or create session
    session = None
    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()

    if not session:
        session = ChatSession(
            dataset_id=dataset.id,
            title=request.question[:60] + ("..." if len(request.question) > 60 else ""),
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Build conversation history from previous messages
    prev_messages = (
        db.query(Message)
        .filter(Message.session_id == session.id)
        .order_by(Message.created_at)
        .all()
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in prev_messages[-10:]  # last 5 turns
    ]

    # Save user message
    user_msg = Message(
        session_id=session.id,
        role="user",
        content=request.question,
    )
    db.add(user_msg)
    db.commit()

    # Parse dataset schema
    schema = json.loads(dataset.schema_json or "{}")
    sample_data = json.loads(dataset.sample_json or "[]")

    # Run agent
    result = run_agent(
        question=request.question,
        dataset_path=dataset.filepath,
        file_type=dataset.file_type,
        schema=schema,
        sample_data=sample_data,
        table_name=dataset.name.lower().replace(" ", "_").replace("-", "_"),
        conversation_history=history,
    )

    # Prepare answer text
    answer = result.get("insight") or result.get("final_answer") or "Analysis complete."
    if not result.get("success") and result.get("error"):
        answer = f"I encountered an error: {result['error']}"

    # Save assistant message
    assistant_msg = Message(
        session_id=session.id,
        role="assistant",
        content=answer,
        tool_used=result.get("tool_used"),
        generated_code=result.get("generated_code"),
        chart_data=json.dumps(result.get("chart_data"), default=str) if result.get("chart_data") else None,
        table_data=json.dumps(result.get("table_data"), default=str) if result.get("table_data") else None,
        insight=result.get("insight"),
        execution_time=result.get("execution_time"),
        error=result.get("error"),
        reasoning_trace=json.dumps(result.get("reasoning_trace", []), default=str),
    )
    db.add(assistant_msg)

    # Save to query history
    qh = QueryHistory(
        dataset_id=dataset.id,
        question=request.question,
        tool_used=result.get("tool_used"),
        generated_code=result.get("generated_code"),
        execution_time=result.get("execution_time"),
        success=result.get("success", False),
    )
    db.add(qh)

    # Update session title if it's still the default
    if len(prev_messages) == 0:
        session.title = request.question[:60] + ("..." if len(request.question) > 60 else "")
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assistant_msg)

    # Format reasoning trace
    reasoning_trace = [
        ReasoningStep(step=r.get("step", ""), detail=r.get("detail", ""))
        for r in result.get("reasoning_trace", [])
    ]

    return ChatResponse(
        session_id=session.id,
        message_id=assistant_msg.id,
        question=request.question,
        answer=answer,
        tool_used=result.get("tool_used"),
        generated_code=result.get("generated_code"),
        chart_data=result.get("chart_data"),
        table_data=result.get("table_data"),
        table_columns=result.get("table_columns"),
        insight=result.get("insight"),
        execution_time=result.get("execution_time"),
        reasoning_trace=reasoning_trace,
        error=result.get("error"),
    )


@router.get("/sessions")
async def list_sessions(db: Session = Depends(get_db)):
    """List all chat sessions."""
    sessions = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).all()
    return [
        {
            "id": s.id,
            "dataset_id": s.dataset_id,
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
            "message_count": len(s.messages),
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: int, db: Session = Depends(get_db)):
    """Get all messages in a session."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at)
        .all()
    )
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "tool_used": m.tool_used,
            "generated_code": m.generated_code,
            "chart_data": json.loads(m.chart_data) if m.chart_data else None,
            "table_data": json.loads(m.table_data) if m.table_data else None,
            "insight": m.insight,
            "execution_time": m.execution_time,
            "reasoning_trace": json.loads(m.reasoning_trace) if m.reasoning_trace else [],
            "error": m.error,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.get("/history")
async def get_query_history(limit: int = 20, db: Session = Depends(get_db)):
    """Get recent query history."""
    history = (
        db.query(QueryHistory)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": h.id,
            "question": h.question,
            "tool_used": h.tool_used,
            "generated_code": h.generated_code,
            "execution_time": h.execution_time,
            "success": h.success,
            "created_at": h.created_at.isoformat(),
        }
        for h in history
    ]
