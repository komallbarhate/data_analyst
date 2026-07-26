import os
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_upload_file():
    sample_path = "uploads/sample_sales.csv"
    with open(sample_path, "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("test_sales.csv", f, "text/csv")}
        )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["row_count"] == 20
    assert data["column_count"] == 10

def test_list_datasets():
    response = client.get("/api/datasets")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
