"""Фоновая отправка состояния киоска в облако (heartbeat).

Раз в CLOUD_REPORT_INTERVAL секунд берёт текущий снимок состояния
(kiosk_state.snapshot() — он уже собирает бумагу, принтер, GS, аптайм, задания)
и POST-ит его в облачный сервис со своим KIOSK_ID + секретом.

Облако по этим данным рисует дашборд. Если облако недоступно — просто пропускаем
итерацию и пробуем снова: на работу самого киоска это никак не влияет.

Включается, только если задан AU_CLOUD_URL (см. config.py). Запускается из
lifespan в main.py рядом с очисткой сессий.
"""
import asyncio
import logging

import httpx

from . import config as cfg
from .kiosk_state import state as kiosk_state

log = logging.getLogger("aucopy-cloud")

# Результаты выполненных команд, которые отправим облаку следующим heartbeat-ом.
_pending_results: list[dict] = []


async def _execute_command(cmd: dict) -> dict:
    """Выполняет одну команду от облака. Возвращает результат для ack."""
    cid = cmd.get("id")
    name = cmd.get("cmd")
    payload = cmd.get("payload") or {}
    try:
        if name == "refill":
            total = payload.get("total")
            await kiosk_state.refill_paper(int(total) if total else None)
            return {"id": cid, "ok": True, "result": f"бумага заправлена ({total})"}
        # Неизвестные команды подтверждаем как неподдержанные (а не молчим).
        return {"id": cid, "ok": False, "result": f"неизвестная команда: {name}"}
    except Exception as exc:
        log.exception("command %s failed", name)
        return {"id": cid, "ok": False, "result": str(exc)}


def _build_payload(snap: dict) -> dict:
    """Превращает полный снимок состояния в компактный heartbeat для облака."""
    paper = snap.get("paper", {})
    jobs = snap.get("jobs", {})
    runtime = snap.get("runtime", {})
    return {
        "region": cfg.KIOSK_REGION,
        "app_version": cfg.APP_VERSION,
        "paper_remaining": paper.get("remaining"),
        "paper_total": paper.get("total"),
        "printer": runtime.get("printer"),
        # Принтер считаем «ок», если задан и Ghostscript на месте (печать возможна).
        "printer_ok": bool(runtime.get("printer")) and bool(runtime.get("gsAvailable")),
        "gs_ok": bool(runtime.get("gsAvailable")),
        "jobs_today": jobs.get("today"),
        "jobs_total": jobs.get("total"),
        "uptime_sec": runtime.get("uptimeSec"),
    }


async def _send_once(client: httpx.AsyncClient) -> None:
    global _pending_results
    snap = await kiosk_state.snapshot()
    payload = _build_payload(snap)
    # Досылаем платежи, которые облако ещё не подтвердило (дедуп по id на той стороне).
    pending = await kiosk_state.unsynced_payments()
    payload["new_payments"] = pending
    # Результаты команд, выполненных в прошлый раз (облако по ним закроет команды).
    payload["command_results"] = list(_pending_results)

    resp = await client.post(
        f"{cfg.CLOUD_URL}/api/heartbeat",
        headers={
            "X-Kiosk-Id": cfg.KIOSK_ID,
            "X-Kiosk-Secret": cfg.KIOSK_SECRET,
        },
        json=payload,
    )
    resp.raise_for_status()

    # Heartbeat принят → помечаем отправленные платежи и сбрасываем ack-и команд.
    if pending:
        await kiosk_state.mark_payments_synced([p["id"] for p in pending])
    _pending_results = []

    # Новые команды от облака — выполняем сразу, результаты уйдут следующим heartbeat.
    try:
        data = resp.json()
    except Exception:
        data = {}
    for cmd in data.get("commands") or []:
        log.info("cloud command: %s", cmd)
        _pending_results.append(await _execute_command(cmd))


async def report_loop() -> None:
    """Бесконечный цикл отправки heartbeat. Падения сети не валят киоск."""
    if not cfg.CLOUD_URL:
        log.info("cloud reporting disabled (AU_CLOUD_URL is empty)")
        return
    log.info("cloud reporting → %s as %s (every %ss)",
             cfg.CLOUD_URL, cfg.KIOSK_ID, cfg.CLOUD_REPORT_INTERVAL)
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            try:
                await _send_once(client)
            except Exception as exc:
                log.warning("heartbeat failed (will retry): %s", exc)
            await asyncio.sleep(cfg.CLOUD_REPORT_INTERVAL)
