import os
import sys
import json
import io
import base64
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database.models import get_db, ChatSession, Message, Dataset
from config import settings

router = APIRouter(prefix="/api", tags=["export"])


def get_session_data(session_id: int, db: Session):
    """Helper to fetch session + messages + dataset."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at)
        .all()
    )
    dataset = db.query(Dataset).filter(Dataset.id == session.dataset_id).first()
    return session, messages, dataset


@router.get("/export/{session_id}/csv")
async def export_csv(session_id: int, db: Session = Depends(get_db)):
    """Export the last query result as CSV."""
    session, messages, dataset = get_session_data(session_id, db)

    # Find last message with table data
    table_data = None
    table_cols = None
    for msg in reversed(messages):
        if msg.table_data:
            table_data = json.loads(msg.table_data)
            break

    if not table_data:
        raise HTTPException(status_code=404, detail="No table data found in this session")

    import pandas as pd
    df = pd.DataFrame(table_data)

    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)

    filename = f"analysis_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(buffer.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/{session_id}/excel")
async def export_excel(session_id: int, db: Session = Depends(get_db)):
    """Export the last query result as Excel."""
    import openpyxl
    import pandas as pd

    session, messages, dataset = get_session_data(session_id, db)

    table_data = None
    for msg in reversed(messages):
        if msg.table_data:
            table_data = json.loads(msg.table_data)
            break

    if not table_data:
        raise HTTPException(status_code=404, detail="No table data found in this session")

    df = pd.DataFrame(table_data)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Analysis", index=False)
    buffer.seek(0)

    filename = f"analysis_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/{session_id}/pdf")
async def export_pdf(session_id: int, db: Session = Depends(get_db)):
    """Generate a PDF report of the session."""
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.units import inch
    from reportlab.lib.enums import TA_LEFT, TA_CENTER

    session, messages, dataset = get_session_data(session_id, db)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=60,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    purple = HexColor("#8b5cf6")
    dark = HexColor("#0f172a")
    light_purple = HexColor("#a78bfa")

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        textColor=purple,
        fontSize=24,
        spaceAfter=6,
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        textColor=light_purple,
        fontSize=14,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["BodyText"],
        fontSize=10,
        spaceAfter=8,
        leading=14,
    )
    code_style = ParagraphStyle(
        "CodeStyle",
        parent=styles["Code"],
        fontSize=8,
        backColor=HexColor("#1e293b"),
        textColor=HexColor("#a78bfa"),
        spaceAfter=8,
        leading=12,
    )

    story = []

    # Title
    story.append(Paragraph("AI Data Analyst Report", title_style))
    story.append(Paragraph(f"Dataset: {dataset.name if dataset else 'Unknown'}", body_style))
    story.append(Paragraph(f"Session: {session.title}", body_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", body_style))
    story.append(Spacer(1, 20))

    # Conversation
    for msg in messages:
        if msg.role == "user":
            story.append(Paragraph(f"❓ {msg.content}", heading_style))
        else:
            # Insight
            if msg.insight:
                story.append(Paragraph(msg.insight, body_style))

            # Generated code
            if msg.generated_code:
                story.append(Paragraph("Generated Code:", ParagraphStyle(
                    "small_head", parent=styles["Heading3"], fontSize=10, textColor=purple
                )))
                code_text = msg.generated_code[:500].replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(f"<font name='Courier'>{code_text}</font>", code_style))

            # Table data
            if msg.table_data:
                td = json.loads(msg.table_data)
                if td:
                    story.append(Paragraph("Results:", ParagraphStyle(
                        "small_head2", parent=styles["Heading3"], fontSize=10, textColor=purple
                    )))
                    rows_to_show = td[:15]
                    cols = list(rows_to_show[0].keys()) if rows_to_show else []
                    table_data_pdf = [cols] + [[str(r.get(c, ""))[:30] for c in cols] for r in rows_to_show]

                    t = Table(table_data_pdf, repeatRows=1)
                    t.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), purple),
                        ("TEXTCOLOR", (0, 0), (-1, 0), white),
                        ("FONTSIZE", (0, 0), (-1, -1), 7),
                        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#f8f7ff")]),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]))
                    story.append(t)

            if msg.execution_time:
                story.append(Paragraph(
                    f"⏱ Execution time: {msg.execution_time:.3f}s | Tool: {msg.tool_used or 'N/A'}",
                    ParagraphStyle("meta", parent=styles["BodyText"], fontSize=8, textColor=HexColor("#94a3b8"))
                ))
            story.append(Spacer(1, 16))

    doc.build(story)
    buffer.seek(0)

    filename = f"report_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/{session_id}/chart-png")
async def export_chart_png(session_id: int, db: Session = Depends(get_db)):
    """Export the last chart as PNG."""
    session, messages, dataset = get_session_data(session_id, db)

    png_b64 = None
    for msg in reversed(messages):
        if msg.chart_data:
            chart = json.loads(msg.chart_data)
            png_b64 = chart.get("png_base64")
            if png_b64:
                break

    if not png_b64:
        raise HTTPException(status_code=404, detail="No chart found in this session")

    img_bytes = base64.b64decode(png_b64)
    filename = f"chart_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    return StreamingResponse(
        io.BytesIO(img_bytes),
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
