#!/usr/bin/env python3
"""VDSS Service Supervisor - Daemonized keepalive for all services.

Usage: python3 supervisor.py  (daemonizes and runs forever)
"""
import os, sys, time, signal, subprocess, socket

def daemonize():
    """Double-fork to fully daemonize the process."""
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    os.chdir('/')
    # Redirect stdio
    sys.stdout.flush()
    sys.stderr.flush()
    devnull_r = open(os.devnull, 'r')
    devnull_w = open(os.devnull, 'w')
    os.dup2(devnull_r.fileno(), sys.stdin.fileno())
    os.dup2(devnull_w.fileno(), sys.stdout.fileno())
    os.dup2(devnull_w.fileno(), sys.stderr.fileno())

SERVICES = [
    (3031, 'index', 'cd /home/z/my-project/mini-services/finpy-tse-service && exec python3 app.py'),
    (3032, 'ml',    'cd /home/z/my-project/mini-services/ml-prediction-service && exec python3 app.py'),
    (3000, 'nextjs','cd /home/z/my-project && exec node .next/standalone/server.js -p 3000'),
]
procs = {}

def check_port(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.settimeout(1)
        s.connect(('127.0.0.1', port))
        s.close()
        return True
    except:
        return False

def start_svc(port, name, cmd):
    if port in procs:
        try:
            os.killpg(os.getpgid(procs[port].pid), signal.SIGKILL)
        except:
            pass
        time.sleep(1)
    log = open(f'/tmp/{name}-svc.log', 'a')
    p = subprocess.Popen(
        cmd, shell=True,
        stdout=log,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid
    )
    procs[port] = p
    log.close()

def main():
    # Start Python services first
    for port, name, cmd in SERVICES[:2]:
        start_svc(port, name, cmd)
    time.sleep(5)
    # Start Next.js
    start_svc(*SERVICES[2])
    time.sleep(5)

    # Monitor loop
    while True:
        time.sleep(15)
        for port, name, cmd in SERVICES:
            if not check_port(port):
                start_svc(port, name, cmd)
                if port == 3000:
                    time.sleep(5)

if __name__ == '__main__':
    daemonize()
    main()
