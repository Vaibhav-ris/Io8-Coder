import os
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json

# Workspace directory to operate on
BASE_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = BASE_DIR / "workspace"
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="VSCode-like IDE Backend", version="0.1.0")

# Allow CORS for local dev
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class RunRequest(BaseModel):
	language: str
	code: str

class PythonRunRequest(BaseModel):
	code: str
	stdin: Optional[str] = None
	timeout: Optional[int] = 10


class FileOpenRequest(BaseModel):
	path: str


class FileSaveRequest(BaseModel):
	path: str
	content: str


def safe_workspace_path(rel_path: str) -> Path:
	"""Ensure path stays within workspace directory."""
	target = (WORKSPACE_DIR / rel_path).resolve()
	if WORKSPACE_DIR not in target.parents and target != WORKSPACE_DIR:
		raise HTTPException(status_code=400, detail="Invalid path")
	return target


def list_directory(path: Path) -> dict:
	"""Return a JSON-serializable tree for the directory."""
	children = []
	for child in sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
		if child.is_dir():
			children.append({
				"type": "folder",
				"name": child.name,
				"path": str(child.relative_to(WORKSPACE_DIR)),
				"children": list_directory(child).get("children", []),
			})
		else:
			children.append({
				"type": "file",
				"name": child.name,
				"path": str(child.relative_to(WORKSPACE_DIR)),
			})
	return {"type": "folder", "name": "workspace", "path": "", "children": children}


@app.get("/files")
async def get_files():
	return list_directory(WORKSPACE_DIR)


@app.post("/files/open")
async def open_file(req: FileOpenRequest):
	path = safe_workspace_path(req.path)
	if not path.exists() or not path.is_file():
		raise HTTPException(status_code=404, detail="File not found")
	try:
		content = path.read_text(encoding="utf-8")
		return {"path": req.path, "content": content}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@app.post("/files/save")
async def save_file(req: FileSaveRequest):
	path = safe_workspace_path(req.path)
	path.parent.mkdir(parents=True, exist_ok=True)
	try:
		path.write_text(req.content, encoding="utf-8")
		return {"ok": True}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@app.post("/files/upload")
async def upload_files(
	files: List[UploadFile] = File(...),
	dest: Optional[str] = Form(default="")
):
	destination_dir = safe_workspace_path(dest)
	destination_dir.mkdir(parents=True, exist_ok=True)
	stored = []
	for uf in files:
		out_path = destination_dir / uf.filename
		with out_path.open("wb") as f:
			shutil.copyfileobj(uf.file, f)
		stored.append(str(out_path.relative_to(WORKSPACE_DIR)))
	return {"stored": stored}


def _run_subprocess(args: List[str], cwd: Path, timeout_sec: int = 10, input_text: Optional[str] = None):
	try:
		completed = subprocess.run(
			args,
			cwd=str(cwd),
			input=input_text,
			stdout=subprocess.PIPE,
			stderr=subprocess.PIPE,
			text=True,
			timeout=timeout_sec,
		)
		return completed.stdout, completed.stderr
	except subprocess.TimeoutExpired:
		return "", "Execution timed out"
	except FileNotFoundError as e:
		return "", f"Command not found: {e}"


@app.post("/run/python")
async def run_python(req: PythonRunRequest):
	with tempfile.TemporaryDirectory() as tmpdir:
		tmp_path = Path(tmpdir)
		code_path = tmp_path / "main.py"
		code_path.write_text(req.code, encoding="utf-8")
		stdout, stderr = _run_subprocess(["python", str(code_path)], tmp_path, timeout_sec=req.timeout or 10, input_text=req.stdin)
		if "not found" in stderr.lower():
			stdout, stderr = _run_subprocess(["python3", str(code_path)], tmp_path, timeout_sec=req.timeout or 10, input_text=req.stdin)
		return {"stdout": stdout, "stderr": stderr}


@app.post("/run")
async def run_code(req: RunRequest):
	language = req.language.lower().strip()
	code = req.code
	with tempfile.TemporaryDirectory() as tmpdir:
		tmp_path = Path(tmpdir)
		if language in ("python", "py"):
			code_path = tmp_path / "main.py"
			code_path.write_text(code, encoding="utf-8")
			stdout, stderr = _run_subprocess(["python", str(code_path)], tmp_path)
			if "not found" in stderr.lower():
				stdout, stderr = _run_subprocess(["python3", str(code_path)], tmp_path)
			return {"stdout": stdout, "stderr": stderr}
		elif language in ("c", ):
			code_path = tmp_path / "main.c"
			code_path.write_text(code, encoding="utf-8")
			_, compile_err = _run_subprocess(["gcc", str(code_path), "-O2", "-std=c11", "-o", "main"], tmp_path)
			if compile_err:
				return {"stdout": "", "stderr": compile_err}
			stdout, stderr = _run_subprocess([str(tmp_path / "main")], tmp_path)
			return {"stdout": stdout, "stderr": stderr}
		elif language in ("cpp", "c++"):
			code_path = tmp_path / "main.cpp"
			code_path.write_text(code, encoding="utf-8")
			_, compile_err = _run_subprocess(["g++", str(code_path), "-O2", "-std=c++17", "-o", "main"], tmp_path)
			if compile_err:
				return {"stdout": "", "stderr": compile_err}
			stdout, stderr = _run_subprocess([str(tmp_path / "main")], tmp_path)
			return {"stdout": stdout, "stderr": stderr}
		elif language in ("javascript", "js", "node"):
			code_path = tmp_path / "main.js"
			code_path.write_text(code, encoding="utf-8")
			stdout, stderr = _run_subprocess(["node", str(code_path)], tmp_path)
			return {"stdout": stdout, "stderr": stderr}
		elif language in ("java", ):
			code_path = tmp_path / "Main.java"
			code_path.write_text(code, encoding="utf-8")
			_, compile_err = _run_subprocess(["javac", str(code_path)], tmp_path)
			if compile_err:
				return {"stdout": "", "stderr": compile_err}
			stdout, stderr = _run_subprocess(["java", "-cp", str(tmp_path), "Main"], tmp_path)
			return {"stdout": stdout, "stderr": stderr}
		else:
			raise HTTPException(status_code=400, detail="Unsupported language. Use python, c, cpp, javascript, or java")


@app.websocket("/ws/python")
async def ws_python(websocket: WebSocket):
	await websocket.accept()
	proc = None
	code = None
	try:
		first = await websocket.receive_text()
		try:
			payload = json.loads(first)
			code = payload.get("code", "")
		except Exception:
			code = first
		# Create temp file and run python with unbuffered output
		with tempfile.TemporaryDirectory() as tmpdir:
			tmp_path = Path(tmpdir)
			code_path = tmp_path / "main.py"
			code_path.write_text(code or "", encoding="utf-8")
			proc = await asyncio.create_subprocess_exec(
				"python", str(code_path),
				stdout=asyncio.subprocess.PIPE,
				stderr=asyncio.subprocess.PIPE,
				stdin=asyncio.subprocess.PIPE,
			)

			async def pump(reader, tag: str):
				while True:
					line = await reader.readline()
					if not line:
						break
					await websocket.send_text(json.dumps({tag: line.decode(errors='ignore')}))

			stdout_task = asyncio.create_task(pump(proc.stdout, "stdout"))
			stderr_task = asyncio.create_task(pump(proc.stderr, "stderr"))

			while True:
				msg = await websocket.receive_text()
				if proc and proc.stdin:
					proc.stdin.write((msg + "\n").encode())
					await proc.stdin.drain()
	except WebSocketDisconnect:
		pass
	finally:
		if proc and proc.returncode is None:
			proc.kill()

# Simple health check
@app.get("/")
async def root():
	return {"status": "ok"}

