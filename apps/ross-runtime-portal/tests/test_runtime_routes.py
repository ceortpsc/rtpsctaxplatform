from fastapi.testclient import TestClient

from app.main import app


def test_public_health_and_assets():
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/favicon.ico").status_code == 200
        assert client.get("/health/live").status_code == 200
        assert client.get("/health/ready").status_code == 200
        assert client.get("/metrics").status_code == 200


def test_authenticated_runtime_console():
    with TestClient(app) as client:
        response = client.post("/access", data={"access_code": "ross-demo"}, follow_redirects=False)
        assert response.status_code == 303
        assert client.get("/runtime-operations").status_code == 200
        status = client.get("/api/v1/runtime/status")
        assert status.status_code == 200
        assert "job_counts" in status.json()["data"]


def test_enqueue_and_report_job():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/runtime/jobs",
            json={"type": "health.snapshot", "queue": "default", "payload": {}},
        )
        assert response.status_code == 201
        assert response.json()["data"]["id"].startswith("job-")
        report = client.post("/api/v1/runtime/reports/generate")
        assert report.status_code == 202
