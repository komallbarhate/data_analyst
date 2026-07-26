from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from datetime import datetime


# ─── Auth ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    username: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Dataset ─────────────────────────────────────────────────────────────────

class DatasetOut(BaseModel):
    id: int
    name: str
    filename: str
    file_type: str
    file_size: int
    row_count: int
    column_count: int
    schema_json: str
    sample_json: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: Optional[int] = None
    dataset_id: int
    question: str
    user_id: Optional[int] = None


class ReasoningStep(BaseModel):
    step: str
    detail: str


class ChatResponse(BaseModel):
    session_id: int
    message_id: int
    question: str
    answer: str
    tool_used: Optional[str] = None
    generated_code: Optional[str] = None
    chart_data: Optional[Dict[str, Any]] = None
    table_data: Optional[List[Dict[str, Any]]] = None
    table_columns: Optional[List[str]] = None
    insight: Optional[str] = None
    execution_time: Optional[float] = None
    reasoning_trace: Optional[List[ReasoningStep]] = None
    error: Optional[str] = None


# ─── Session ──────────────────────────────────────────────────────────────────

class SessionOut(BaseModel):
    id: int
    dataset_id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    tool_used: Optional[str] = None
    generated_code: Optional[str] = None
    chart_data: Optional[str] = None
    table_data: Optional[str] = None
    insight: Optional[str] = None
    execution_time: Optional[float] = None
    reasoning_trace: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Query History ────────────────────────────────────────────────────────────

class QueryHistoryOut(BaseModel):
    id: int
    question: str
    tool_used: Optional[str] = None
    generated_code: Optional[str] = None
    execution_time: Optional[float] = None
    success: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Export ──────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    session_id: int
    format: str  # "pdf" | "csv" | "excel"
