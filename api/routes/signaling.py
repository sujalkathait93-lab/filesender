"""
FileShare WebRTC Signaling Handlers (Flask-SocketIO)
Handles room management, WebRTC offer/answer/ICE candidate relay, and transfer status events.
Thread-safe synchronized room management.
"""

import threading
from flask import request
from flask_socketio import SocketIO, join_room, leave_room, emit

_rooms_lock = threading.Lock()
active_rooms = {}


def register_signaling_handlers(socketio: SocketIO):
    """Register all SocketIO event handlers for WebRTC signaling."""

    @socketio.on("connect")
    def handle_connect():
        pass

    @socketio.on("join_room")
    def handle_join_room(data):
        if not isinstance(data, dict):
            return
        room = str(data.get("room", "")).strip()[:128]
        role = str(data.get("role", "peer"))[:32]
        if not room:
            return

        join_room(room)
        meta = None
        with _rooms_lock:
            if room not in active_rooms:
                active_rooms[room] = {"members": [], "meta": None}

            if request.sid not in active_rooms[room]["members"]:
                active_rooms[room]["members"].append(request.sid)

            member_count = len(active_rooms[room]["members"])
            meta = active_rooms[room]["meta"]

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
        room = data.get("room")
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
        room = data.get("room")
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
        room = data.get("room")
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
        room = data.get("room")
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
        room = data.get("room")
        last_chunk_index = data.get("last_chunk_index", -1)
        if room:
            emit("request_resume", {
                "last_chunk_index": last_chunk_index
            }, to=room, include_self=False)

    @socketio.on("transfer_status")
    def handle_transfer_status(data):
        if not isinstance(data, dict):
            return
        room = data.get("room")
        status = data.get("status")
        if room and status:
            emit("transfer_status", status, to=room, include_self=False)

    @socketio.on("leave_room")
    def handle_leave_room(data):
        if not isinstance(data, dict):
            return
        room = data.get("room")
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
