"""把插件目录上传到 GitHub（纯 API，不需要 git）。
用法：
  python upload_github.py --token ghp_xxx --repo dsh-bili-manager --public
  python upload_github.py --token ghp_xxx --repo dsh-bili-manager --update   # 仓库已存在时更新文件
"""
import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error

API = "https://api.github.com"
EXCLUDE = {".git", "node_modules", "__pycache__", ".DS_Store"}


def call(method, url, token, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500]
        raise RuntimeError(f"HTTP {e.code}: {body}")


def walk_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE]
        for fn in filenames:
            if fn in EXCLUDE:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace("\\", "/")
            yield rel, full


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", required=True)
    ap.add_argument("--repo", default="dsh-bili-manager")
    ap.add_argument("--dir", default=os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--description", default="DSH 插件：B站 账号运营工具箱（读创作数据 / 回评论 / 置顶 / 发弹幕）")
    ap.add_argument("--private", action="store_true")
    ap.add_argument("--update", action="store_true", help="仓库已存在时更新文件")
    args = ap.parse_args()

    me = call("GET", f"{API}/user", args.token)
    owner = me["login"]
    print(f"[1/3] GitHub 账号：{owner}")

    repo = None
    if args.update:
        try:
            repo = call("GET", f"{API}/repos/{owner}/{args.repo}", args.token)
        except RuntimeError:
            repo = None
    if not repo:
        try:
            repo = call("POST", f"{API}/user/repos", args.token, {
                "name": args.repo,
                "description": args.description,
                "private": bool(args.private),
                "auto_init": True,
            })
            print(f"[2/3] 已创建仓库：{repo['html_url']}")
        except RuntimeError as e:
            if "already exists" in str(e) or "name already exists" in str(e) or "HTTP 422" in str(e):
                repo = call("GET", f"{API}/repos/{owner}/{args.repo}", args.token)
            else:
                raise
    if not repo:
        sys.exit("仓库创建/获取失败")
    branch = repo.get("default_branch", "main")
    print(f"[2/3] 仓库：{repo['html_url']}（分支 {branch}）")

    files = sorted(walk_files(args.dir))
    print(f"[3/3] 上传 {len(files)} 个文件 …")
    for rel, full in files:
        content = open(full, "rb").read()
        b64 = base64.b64encode(content).decode()
        url = f"{API}/repos/{owner}/{args.repo}/contents/{rel}"
        # 已存在则取 sha 覆盖
        sha = None
        try:
            old = call("GET", f"{url}?ref={branch}", args.token)
            sha = old.get("sha")
        except RuntimeError:
            pass
        data = {"message": f"add {rel}", "content": b64, "branch": branch}
        if sha:
            data["sha"] = sha
        try:
            call("PUT", url, args.token, data)
            print("  ✓", rel)
        except RuntimeError as e:
            print("  ✗", rel, str(e)[:100])
    print("完成:", repo["html_url"])


if __name__ == "__main__":
    main()
