"""Load local configuration consistently; deployed environment values take priority."""
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parents[1] if BACKEND_DIR.parent.name == 'grant-report-generator' else BACKEND_DIR
load_dotenv(BACKEND_DIR / '.env')
load_dotenv(PROJECT_ROOT / '.env')
