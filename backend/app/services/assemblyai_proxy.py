import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
import websockets

from app.core.config import settings
from app.core.prompt import get_session_update_payload, DEFAULT_VOICE_EN
from app.services.tool_coordinator import ToolCallCoordinator

logger = logging.getLogger("voice_agent_proxy")


async def handle_agent_proxy(client_ws: WebSocket):
    """Establishes a bidirectional bridge between the web client and the AssemblyAI Voice Agent WebSocket with bilingual support."""
    await client_ws.accept()

    api_key = settings.ASSEMBLYAI_API_KEY.strip()
    if not api_key or api_key == "tu_assemblyai_api_key_aqui":
        logger.warning("ASSEMBLYAI_API_KEY is not configured.")
        await client_ws.send_json({
            "type": "error",
            "message": "ASSEMBLYAI_API_KEY is not configured. Please add your key in backend/.env"
        })
        await client_ws.close(code=1008)
        return

    headers = {
        "Authorization": f"Bearer {api_key}"
    }

    try:
        async with websockets.connect(
            settings.ASSEMBLYAI_WS_URL,
            additional_headers=headers,
            ping_interval=20,
            ping_timeout=20,
            max_size=10 * 1024 * 1024
        ) as aai_ws:
            logger.info("Connected to AssemblyAI Voice Agent WebSocket.")

            aai_send_lock = asyncio.Lock()

            async def send_to_aai(payload):
                message = json.dumps(payload) if isinstance(payload, dict) else payload
                async with aai_send_lock:
                    await aai_ws.send(message)

            tool_coordinator = ToolCallCoordinator(send_to_aai, logger=logger)

            # Send initial agent configuration (English default with Eve voice)
            session_payload = get_session_update_payload(voice=DEFAULT_VOICE_EN)
            await send_to_aai(session_payload)
            logger.info("Default English session.update payload sent to AssemblyAI.")

            # Task: Forward stream from web client to AssemblyAI
            async def forward_client_to_aai():
                try:
                    while True:
                        data = await client_ws.receive()
                        if data.get("type") == "websocket.disconnect":
                            break
                        if "bytes" in data and data["bytes"]:
                            await send_to_aai(data["bytes"])
                        elif "text" in data and data["text"]:
                            # Check if the client requested an explicit voice/language switch.
                            try:
                                ctrl = json.loads(data["text"])
                            except json.JSONDecodeError:
                                ctrl = None

                            if isinstance(ctrl, dict) and ctrl.get("type") == "change_voice":
                                new_voice = ctrl.get("voice", "lola")
                                logger.info(f"Client requested manual voice change to {new_voice}")
                                update_msg = {
                                    "type": "session.update",
                                    "session": {
                                        "output": {"voice": new_voice}
                                    }
                                }
                                await send_to_aai(update_msg)
                                continue

                            await send_to_aai(data["text"])
                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass
                except RuntimeError as e:
                    # Clean handling if client already disconnected
                    if "disconnect" in str(e).lower():
                        pass
                    else:
                        logger.error(f"RuntimeError client -> AssemblyAI: {e}")
                except Exception as e:
                    logger.error(f"Error forwarding client -> AssemblyAI: {e}")

            # Task: Forward stream from AssemblyAI to web client
            async def forward_aai_to_client():
                try:
                    async for message in aai_ws:
                        if isinstance(message, bytes):
                            await client_ws.send_bytes(message)
                        elif isinstance(message, str):
                            try:
                                event = json.loads(message)
                            except json.JSONDecodeError:
                                await client_ws.send_text(message)
                                continue

                            if not isinstance(event, dict):
                                await client_ws.send_text(message)
                                continue

                            event_type = event.get("type") or event.get("event")
                            try:
                                if event_type in ("tool.call", "tool_call"):
                                    tool = event.get("tool") or event
                                    tool_name = tool.get("name") or tool.get("function", {}).get("name")
                                    tool_call_id = tool.get("call_id") or tool.get("id") or event.get("call_id") or event.get("id")
                                    if tool_call_id:
                                        tool_arguments = tool.get("parameters") or tool.get("arguments") or tool.get("args") or {}
                                        tool_coordinator.register(
                                            tool_call_id,
                                            tool_name or "unknown",
                                            tool_arguments,
                                        )

                                    # Dynamic voice handling remains unchanged until the language/voice phase.
                                    if tool_name == "switch_language_voice":
                                        params = tool.get("parameters") or tool.get("arguments") or {}
                                        if isinstance(params, str):
                                            params = json.loads(params)
                                        target_voice = params.get("voice") or ("lola" if params.get("language") == "es" else "eve")
                                        logger.info(f"Tool triggered voice switch to: {target_voice}")
                                        voice_update = {
                                            "type": "session.update",
                                            "session": {
                                                "output": {"voice": target_voice}
                                            }
                                        }
                                        await send_to_aai(voice_update)

                            except Exception as ex:
                                logger.warning(f"Error handling AssemblyAI event: {ex}")

                            await client_ws.send_text(message)

                            try:
                                if event_type in ("reply.done", "reply_done"):
                                    await tool_coordinator.finish_reply(
                                        interrupted=(event.get("status") == "interrupted" or bool(event.get("interrupted"))),
                                    )
                            except Exception as ex:
                                logger.warning(f"Error coordinating AssemblyAI event: {ex}")
                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass
                except RuntimeError as e:
                    if "disconnect" in str(e).lower():
                        pass
                    else:
                        logger.error(f"RuntimeError AssemblyAI -> client: {e}")
                except Exception as e:
                    logger.error(f"Error forwarding AssemblyAI -> client: {e}")

            # Run both forwarding tasks concurrently
            client_task = asyncio.create_task(forward_client_to_aai())
            aai_task = asyncio.create_task(forward_aai_to_client())

            done, pending = await asyncio.wait(
                [client_task, aai_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            for task in pending:
                task.cancel()
            tool_coordinator.cancel_all()
            await asyncio.gather(*pending, return_exceptions=True)

    except websockets.exceptions.InvalidStatusCode as e:
        logger.error(f"AssemblyAI rejected connection (Status: {e.status_code}): {e}")
        try:
            await client_ws.send_json({
                "type": "error",
                "message": f"AssemblyAI authentication error: code {e.status_code}. Check your API key."
            })
            await client_ws.close()
        except Exception:
            pass
    except Exception as e:
        logger.error(f"WebSocket proxy exception: {e}")
        try:
            await client_ws.send_json({
                "type": "error",
                "message": f"Connection error: {str(e)}"
            })
            await client_ws.close()
        except Exception:
            pass
