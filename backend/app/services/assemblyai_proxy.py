import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
import websockets

from app.core.config import settings
from app.core.prompt import DEFAULT_VOICE_EN, VOICE_LANGUAGES, get_session_update_payload
from app.services.performance_summary import sanitize_performance_summary
from app.services.tool_coordinator import ToolCallCoordinator

logger = logging.getLogger("voice_agent_proxy")

END_TOOL_PENDING = "tool_pending"
END_FEEDBACK_PENDING = "feedback_pending"
END_PLAYBACK_PENDING = "playback_pending"


def resolve_voice_config(requested_voice: str | None) -> tuple[str, str]:
    """Validate the pre-session voice and return its linked initial language."""
    voice = (requested_voice or DEFAULT_VOICE_EN).strip().lower()
    if voice not in VOICE_LANGUAGES:
        logger.warning("Unsupported voice '%s'; using %s", voice, DEFAULT_VOICE_EN)
        voice = DEFAULT_VOICE_EN
    return voice, VOICE_LANGUAGES[voice]


async def finish_tool_reply(
    tool_coordinator: ToolCallCoordinator,
    send_to_aai,
    send_to_client,
    *,
    end_session_state: str | None,
    interrupted: bool,
) -> str | None:
    """Advance the final feedback flow after an AssemblyAI reply completes."""
    await tool_coordinator.finish_reply(interrupted=interrupted)
    if end_session_state == END_TOOL_PENDING:
        if interrupted:
            await send_to_client({"type": "proxy.session_end_cancelled"})
            return None
        logger.info("Sent measured session summary; waiting for final feedback reply")
        return END_FEEDBACK_PENDING
    if end_session_state == END_FEEDBACK_PENDING:
        await send_to_client({"type": "proxy.playback_drain_requested"})
        logger.info("Waiting for final feedback playback to finish before ending session")
        return END_PLAYBACK_PENDING
    return end_session_state


async def finish_end_session(send_to_aai, *, end_session_state: str | None) -> str | None:
    """End the upstream session after final feedback playback is drained."""
    if end_session_state != END_PLAYBACK_PENDING:
        return end_session_state
    await send_to_aai({"type": "session.end"})
    logger.info("Sent session.end after final feedback playback finished")
    return None


async def handle_agent_proxy(client_ws: WebSocket):
    """Establishes a bidirectional bridge between the web client and the AssemblyAI Voice Agent WebSocket with bilingual support."""
    await client_ws.accept()

    selected_voice, initial_language = resolve_voice_config(
        client_ws.query_params.get("voice")
    )

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

            async def send_to_client(payload):
                message = json.dumps(payload) if isinstance(payload, dict) else payload
                await client_ws.send_text(message)

            tool_coordinator = ToolCallCoordinator(send_to_aai, logger=logger)
            end_session_state = None

            # Voice is immutable after this initial session.update.
            session_payload = get_session_update_payload(
                voice=selected_voice,
                language=initial_language,
            )
            await send_to_aai(session_payload)
            logger.info(
                "Initial session.update sent [voice=%s, language=%s]",
                selected_voice,
                initial_language,
            )

            # Task: Forward stream from web client to AssemblyAI
            async def forward_client_to_aai():
                nonlocal end_session_state
                try:
                    while True:
                        data = await client_ws.receive()
                        if data.get("type") == "websocket.disconnect":
                            break
                        if "bytes" in data and data["bytes"]:
                            await send_to_aai(data["bytes"])
                        elif "text" in data and data["text"]:
                            text = data["text"]
                            try:
                                event = json.loads(text)
                            except json.JSONDecodeError:
                                event = None

                            if isinstance(event, dict) and event.get("type") == "client.tool_result":
                                call_id = event.get("call_id")
                                if call_id:
                                    if tool_coordinator.get_pending_name(call_id) == "end_session":
                                        logger.warning(
                                            "Ignoring unvalidated end_session tool result [id=%s]",
                                            call_id,
                                        )
                                        continue
                                    tool_coordinator.set_client_result(
                                        call_id,
                                        event.get("result", {}),
                                        is_error=bool(event.get("is_error")),
                                    )
                                else:
                                    logger.warning("Ignoring client.tool_result without call_id")
                                continue

                            if isinstance(event, dict) and event.get("type") == "client.performance_summary":
                                call_id = event.get("call_id")
                                if not call_id:
                                    logger.warning("Ignoring performance summary without call_id")
                                    continue
                                if tool_coordinator.get_pending_name(call_id) != "end_session":
                                    logger.warning(
                                        "Ignoring performance summary for unknown call [id=%s]",
                                        call_id,
                                    )
                                    continue
                                summary = sanitize_performance_summary(event.get("summary"))
                                tool_coordinator.set_client_result(
                                    call_id,
                                    {
                                        "status": "success",
                                        "applied": True,
                                        "performance_summary": summary,
                                    },
                                )
                                logger.info("Validated final performance summary [id=%s]", call_id)
                                continue

                            if isinstance(event, dict) and event.get("type") == "client.playback_drained":
                                if event.get("timed_out"):
                                    logger.warning("Client playback drain timed out before session end")
                                end_session_state = await finish_end_session(
                                    send_to_aai,
                                    end_session_state=end_session_state,
                                )
                                continue

                            await send_to_aai(text)
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
                nonlocal end_session_state
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
                                        if tool_name == "end_session":
                                            end_session_state = END_TOOL_PENDING

                            except Exception as ex:
                                logger.warning(f"Error handling AssemblyAI event: {ex}")

                            await client_ws.send_text(message)

                            try:
                                if event_type in ("reply.done", "reply_done"):
                                    end_session_state = await finish_tool_reply(
                                        tool_coordinator,
                                        send_to_aai,
                                        send_to_client,
                                        end_session_state=end_session_state,
                                        interrupted=(
                                            event.get("status") == "interrupted"
                                            or bool(event.get("interrupted"))
                                        ),
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
