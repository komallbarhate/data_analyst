from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite specific
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    datasets = relationship("Dataset", back_populates="owner")
    sessions = relationship("ChatSession", back_populates="owner")


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    file_type = Column(String, nullable=False)   # csv, excel, sqlite
    file_size = Column(Integer, default=0)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    schema_json = Column(Text, default="{}")     # JSON string of column types
    sample_json = Column(Text, default="[]")     # JSON string of first 5 rows
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="datasets")
    sessions = relationship("ChatSession", back_populates="dataset")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    title = Column(String, default="New Analysis")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="sessions")
    dataset = relationship("Dataset", back_populates="sessions")
    messages = relationship("Message", back_populates="session", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    # Agent-specific fields
    tool_used = Column(String, nullable=True)        # "sql" | "python" | "chart" | "stats"
    generated_code = Column(Text, nullable=True)     # Generated SQL or Python code
    chart_data = Column(Text, nullable=True)         # JSON chart data
    table_data = Column(Text, nullable=True)         # JSON table data
    insight = Column(Text, nullable=True)            # AI explanation
    execution_time = Column(Float, nullable=True)    # seconds
    error = Column(Text, nullable=True)
    reasoning_trace = Column(Text, nullable=True)    # JSON list of agent steps
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


class QueryHistory(Base):
    __tablename__ = "query_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    question = Column(Text, nullable=False)
    tool_used = Column(String, nullable=True)
    generated_code = Column(Text, nullable=True)
    execution_time = Column(Float, nullable=True)
    success = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
