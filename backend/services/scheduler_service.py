from __future__ import annotations

import logging
import socket
from typing import Final

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.history_service import save_live_snapshot

logger = logging.getLogger(__name__)

_SCHEDULER_LOCK_HOST: Final[str] = "127.0.0.1"
_SCHEDULER_LOCK_PORT: Final[int] = 47219

_scheduler: BackgroundScheduler | None = None
_lock_socket: socket.socket | None = None


def _acquire_process_lock() -> bool:
    global _lock_socket

    if _lock_socket is not None:
        return True

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        sock.bind((_SCHEDULER_LOCK_HOST, _SCHEDULER_LOCK_PORT))
        sock.listen(1)
    except OSError:
        sock.close()
        return False

    _lock_socket = sock
    return True


def _release_process_lock() -> None:
    global _lock_socket

    if _lock_socket is not None:
        _lock_socket.close()
        _lock_socket = None


def _run_snapshot_job() -> None:
    try:
        result = save_live_snapshot()
        logger.info("Hourly history snapshot saved: %s", result)
    except Exception:
        logger.exception("Hourly history snapshot failed")


def start_snapshot_scheduler() -> bool:
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        return True

    # Prevent duplicate scheduler instances in dev reload mode.
    if not _acquire_process_lock():
        logger.info("Snapshot scheduler not started: another process holds scheduler lock")
        return False

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        _run_snapshot_job,
        trigger=IntervalTrigger(hours=1),
        id="save_live_snapshot_hourly",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=180,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("Snapshot scheduler started with 1-hour interval")
    return True


def stop_snapshot_scheduler() -> None:
    global _scheduler

    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None

    _release_process_lock()