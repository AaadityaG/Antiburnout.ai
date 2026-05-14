# Save Eyes Reminder Backend

## Setup

### Windows

manually:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Mac/Linux

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Running the Server

```bash
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Mac/Linux

uvicorn main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
