import subprocess
import webbrowser
import os
import sys
import time
import socket

PORT = 8085

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def run_server():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)
    server_js = os.path.join(base_dir, 'backend', 'server.js')

    # Check if server is already running
    if is_port_in_use(PORT):
        url = f"http://localhost:{PORT}"
        print("=" * 65)
        print(f" 🚀 SSC CGL Full-Stack CBT Platform is already running!")
        print(f" 🌐 Opening browser at: {url}")
        print("=" * 65)
        webbrowser.open(url)
        return

    print("=" * 65)
    print(" 🚀 Starting SSC CGL Full-Stack CBT Platform Backend...")
    print(" 🌐 Serving: Exam CBT, SQLite Database, REST APIs & Analytics")
    print("=" * 65)

    try:
        proc = subprocess.Popen(["node", server_js], cwd=base_dir)
        
        # Wait up to 10 seconds for server to respond on port 8085
        ready = False
        for _ in range(20):
            if is_port_in_use(PORT):
                ready = True
                break
            time.sleep(0.5)

        url = f"http://localhost:{PORT}"
        print(f" ✓ Platform active at: {url}")
        print(" Press Ctrl+C to stop the platform.\n")
        webbrowser.open(url)
        
        proc.wait()
    except KeyboardInterrupt:
        print("\nStopping CBT server...")
        if 'proc' in locals():
            proc.terminate()
    except FileNotFoundError:
        print("\n❌ Error: Node.js was not found on your system PATH.")
        print("Please ensure Node.js is installed to run the full-stack CBT platform.")
        sys.exit(1)

if __name__ == '__main__':
    run_server()
