import socket

servers = ["127.0.0.1:8000", "localhost:8000"]
for s in servers:
    try:
        host, port = s.split(":")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, int(port)))
        if result == 0:
            print(f"Server is listening on {s}")
        else:
            print(f"Cannot connect to {s}")
        sock.close()
    except Exception as e:
        print(f"Error checking {s}: {e}")