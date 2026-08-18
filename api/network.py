"""
FileShare Network Utilities
Primary Responsibility: Host network detection and local IP resolution.
"""

import socket


def get_local_ips() -> list[str]:
    """Discover reachable local network IP addresses."""
    ips = []
    try:
        hostname = socket.gethostname()
        ips.append(socket.gethostbyname(hostname))
    except Exception:
        pass

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass

    return list(set(ips))
