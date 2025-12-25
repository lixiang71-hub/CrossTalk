import os
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

# Absolute import from the flattened structure
from core.prompts import SYSTEM_PROMPTS

load_dotenv()

class TranslationState(TypedDict):
    content: str
    direction: str
    result: str

def translate_node(state: TranslationState):
    direction = state.get("direction")
    content = state.get("content")
    
    if direction not in SYSTEM_PROMPTS:
        return {"result": f"Error: Invalid direction {direction}"}
    
    system_prompt = SYSTEM_PROMPTS[direction]
    
    llm = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4o"),
        temperature=0.3,
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL")
    )
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"请翻译以下内容：\n\n{content}")
    ]
    
    response = llm.invoke(messages)
    return {"result": response.content}

workflow = StateGraph(TranslationState)
workflow.add_node("translate", translate_node)
workflow.set_entry_point("translate")
workflow.add_edge("translate", END)

app_graph = workflow.compile()
