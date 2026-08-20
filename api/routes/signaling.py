"""
FileShare WebRTC Signaling Handlers (Flask-SocketIO)
Handles room management, WebRTC offer/answer/ICE candidate relay, and transfer status events.
Thread-safe synchronized room management.
"""

import re
import threading
from flask import request
from flask_socketio import SocketIO, join_room, leave_room, emit
from api.config import MAX_SYSTEM_USERS

_rooms_lock = threading.Lock()
active_rooms = {}
_ROOM_ID_RE = re.compile(r"^[0-9a-fA-F]{8,32}$")
_MAX_ROOM_MEMBERS = 2


def _valid_room(room) -> str:
    room = str(room or "").strip()[:128]
    if not room or not _ROOM_ID_RE.match(room):
        return ""
    return room


def register_signaling_handlers(socketio: SocketIO):
    """Register all SocketIO event handlers for WebRTC signaling."""

    @socketio.on("connect")
    def handle_connect():
        pass

    @socketio.on("join_room")
    def handle_join_room(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        role = str(data.get("role", "peer"))[:32]
        if not room:
            return

        with _rooms_lock:
            # Enforce system limit of 20 concurrent users across signaling
            total_active_peers = sum(len(r.get("members", [])) for r in active_rooms.values())
            is_existing_member = any(request.sid in r.get("members", []) for r in active_rooms.values())
            if not is_existing_member and total_active_peers >= MAX_SYSTEM_USERS:
                emit("room_full", {"room": room, "reason": "system_capacity_reached", "max_users": MAX_SYSTEM_USERS})
                return

            if room not in active_rooms:
                active_rooms[room] = {"members": [], "meta": None}

            if request.sid not in active_rooms[room]["members"]:
                if len(active_rooms[room]["members"]) >= _MAX_ROOM_MEMBERS:
                    emit("room_full", {"room": room})
                    return
                active_rooms[room]["members"].append(request.sid)

            member_count = len(active_rooms[room]["members"])
            meta = active_rooms[room]["meta"]

        join_room(room)
        emit("room_joined", {
            "room": room,
            "role": role,
            "peer_count": member_count,
            "meta": meta
        }, to=room)

    @socketio.on("webrtc_offer")
    def handle_offer(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        offer = data.get("offer")
        if room and offer:
            emit("webrtc_offer", {
                "offer": offer,
                "sender_sid": request.sid
            }, to=room, include_self=False)

    @socketio.on("webrtc_answer")
    def handle_answer(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        answer = data.get("answer")
        if room and answer:
            emit("webrtc_answer", {
                "answer": answer,
                "sender_sid": request.sid
            }, to=room, include_self=False)

    @socketio.on("ice_candidate")
    def handle_ice_candidate(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        candidate = data.get("candidate")
        if room and candidate:
            emit("ice_candidate", {
                "candidate": candidate,
                "sender_sid": request.sid
            }, to=room, include_self=False)

    @socketio.on("transfer_meta")
    def handle_transfer_meta(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        meta = data.get("meta")
        if room and meta:
            with _rooms_lock:
                if room in active_rooms:
                    active_rooms[room]["meta"] = meta
            emit("transfer_meta", {
                "meta": meta
            }, to=room, include_self=False)

    @socketio.on("request_resume")
    def handle_request_resume(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        last_chunk_index = data.get("last_chunk_index", -1)
        if room:
            emit("request_resume", {
                "last_chunk_index": last_chunk_index
            }, to=room, include_self=False)

    @socketio.on("transfer_status")
    def handle_transfer_status(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        status = data.get("status")
        if room and status:
            emit("transfer_status", status, to=room, include_self=False)

    @socketio.on("leave_room")
    def handle_leave_room(data):
        if not isinstance(data, dict):
            return
        room = _valid_room(data.get("room"))
        if room:
            leave_room(room)
            with _rooms_lock:
                if room in active_rooms and request.sid in active_rooms[room]["members"]:
                    active_rooms[room]["members"].remove(request.sid)
                    if not active_rooms[room]["members"]:
                        del active_rooms[room]

    @socketio.on("disconnect")
    def handle_disconnect():
        with _rooms_lock:
            for room, room_data in list(active_rooms.items()):
                if request.sid in room_data["members"]:
                    room_data["members"].remove(request.sid)
                    emit("peer_disconnected", {"sid": request.sid}, to=room)
                    if not room_data["members"]:
                        del active_rooms[room]
