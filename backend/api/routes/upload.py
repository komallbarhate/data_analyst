import os
import json
import shutil
import pandas as pd
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.models import get_db, Dataset
from tools.sql_tool import sql_tool
from config import settings

router = APIRouter(prefix="/api", tags=["upload"])

ALLOWED_TYPES = {
    "text/csv": "csv",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/octet-stream": "sqlite",
    "application/x-sqlite3": "sqlite",
}

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".sqlite", ".db"}


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a CSV, Excel, or SQLite file and extract schema."""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    file_type = ext.lstrip(".")
    if file_type in ("xls", "xlsx"):
        file_type = "excel"

    # Save file
    save_path = settings.UPLOAD_DIR / file.filename
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(save_path)

    # Extract schema
    schema_info = sql_tool.get_schema(str(save_path), file_type)
    if "error" in schema_info:
        os.remove(save_path)
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {schema_info['error']}")

    # Save to DB
    dataset = Dataset(
        name=Path(file.filename).stem,
        filename=file.filename,
        filepath=str(save_path),
        file_type=file_type,
        file_size=file_size,
        row_count=schema_info.get("row_count", 0),
        column_count=schema_info.get("col_count", 0),
        schema_json=json.dumps(schema_info.get("schema", {}), default=str),
        sample_json=json.dumps(schema_info.get("sample", []), default=str),
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return {
        "id": dataset.id,
        "name": dataset.name,
        "filename": dataset.filename,
        "file_type": dataset.file_type,
        "file_size": dataset.file_size,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "schema": schema_info.get("schema", {}),
        "sample": schema_info.get("sample", []),
        "table_name": schema_info.get("table_name", ""),
        "created_at": dataset.created_at.isoformat(),
    }


@router.get("/datasets")
async def list_datasets(db: Session = Depends(get_db)):
    """List all uploaded datasets."""
    datasets = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "filename": d.filename,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "row_count": d.row_count,
            "column_count": d.column_count,
            "schema": json.loads(d.schema_json or "{}"),
            "sample": json.loads(d.sample_json or "[]"),
            "created_at": d.created_at.isoformat(),
        }
        for d in datasets
    ]


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Get dataset details."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {
        "id": dataset.id,
        "name": dataset.name,
        "filename": dataset.filename,
        "file_type": dataset.file_type,
        "file_size": dataset.file_size,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "schema": json.loads(dataset.schema_json or "{}"),
        "sample": json.loads(dataset.sample_json or "[]"),
        "created_at": dataset.created_at.isoformat(),
    }


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Delete a dataset and its file."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Remove file
    if os.path.exists(dataset.filepath):
        os.remove(dataset.filepath)

    db.delete(dataset)
    db.commit()
    return {"message": "Dataset deleted successfully"}
