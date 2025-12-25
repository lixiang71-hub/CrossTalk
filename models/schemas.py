from pydantic import BaseModel

class TranslationRequest(BaseModel):
    content: str
    direction: str  # 'pm_to_dev' or 'dev_to_pm'
