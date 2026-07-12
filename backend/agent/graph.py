from typing import Literal
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from datetime import datetime
import asyncio


def build_system_prompt(user: dict, system_metrics: dict = None) -> str:
    created_at = datetime.fromisoformat(user.get("created_at", datetime.utcnow().isoformat()))
    days_using = (datetime.utcnow() - created_at).days

    user_id = user.get("id", "")

    metrics_context = ""
    if system_metrics:
        b = system_metrics.get("brightness")
        v = system_metrics.get("volume")
        nm = system_metrics.get("is_night_mode_enabled")
        parts = []
        if b is not None:
            parts.append(f"Current brightness: {b}%")
        if v is not None:
            parts.append(f"Current volume: {v}%")
        if nm is not None:
            parts.append(f"Night mode: {'enabled' if nm else 'disabled'}")
        if parts:
            metrics_context = "\nCurrent system readings from the user's device:\n" + "\n".join(f"- {p}" for p in parts)

    return f"""You are AntiBurnout Assistant, an AI wellness coach helping users prevent digital burnout during long screen sessions.

Your capabilities:
- Check and optimize system settings (brightness, volume, night mode) using check_system_settings
- View the user's activity history using get_user_activity
- View the user's break schedule preferences using get_user_break_settings
- Provide wellness break tips using get_break_tip

IMPORTANT - User ID: Always pass user_id="{user_id}" when calling get_user_activity or get_user_break_settings.
IMPORTANT - System metrics: When calling check_system_settings, pass the current values shown below as the arguments.

Rules:
- When the user asks about their settings, burnout, wellness, or mentions brightness/volume/night mode → call check_system_settings with the current values below
- When the user asks about their progress, activity, or work patterns → call get_user_activity
- When the user asks for a break tip → call get_break_tip
- When the user asks about their break schedule → call get_user_break_settings
- Keep responses under 100 words unless asked for details
- Be specific, actionable, and encouraging
- If settings need adjustment, briefly mention the key changes and tell the user they can click Execute to apply
- If settings are already optimal, confirm and ask what else is bothering them
- Focus on prevention, not just treatment
{metrics_context}

User Context:
- Has been using AntiBurnout for {days_using} days
- Works long hours on screens
- Wants to prevent burnout and maintain wellness"""


def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return "__end__"


def create_agent_graph(
    api_key: str,
    model: str,
    user: dict,
    system_metrics: dict = None,
):
    llm = ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        max_tokens=500,
        temperature=0.7,
        timeout=30,
        max_retries=1,
        default_headers={
            "HTTP-Referer": "https://antiburnout.ai",
            "X-Title": "AntiBurnout",
        },
    )

    from agent.tools import (
        check_system_settings,
        get_user_activity,
        get_user_break_settings,
        get_break_tip,
    )

    tools = [check_system_settings, get_user_activity, get_user_break_settings, get_break_tip]
    llm_with_tools = llm.bind_tools(tools)

    tool_node = ToolNode(tools)

    async def agent_node(state: MessagesState):
        response = await llm_with_tools.ainvoke(state["messages"])
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "__end__": END})
    graph.add_edge("tools", "agent")

    return graph.compile()
