# Windows deployment

The Photo Tools stack runs on any Windows machine (including Windows Server).
This guide covers production builds and the two most common setups.

## 1. Production builds

```powershell
# Backend -> dist/ (plain Node, no TS runtime needed)
cd backend
npm ci
npm run build

# Frontend -> .next/ (optimized static + server build)
cd frontend
npm ci
npm run build
```

The backend reads `.env` from the project root (`photo-tools/.env`). For
production set:

```
NODE_ENV=production
FRONTEND_ORIGINS=https://your-domain
API_KEYS=super-secret-key        # required when exposed
```

The frontend reads `frontend/.env.local`; set `BACKEND_URL` and `API_KEY` there.

## 2. Running the services

Use [NSSM](https://nssm.cc/) (the Non-Sucking Service Manager) or Task Scheduler
to keep both processes alive as Windows services:

```powershell
# Example with NSSM
nssm install PhotoToolsBackend "C:\Program Files\nodejs\node.exe" "S:\...\photo-tools\backend\dist\index.js"
nssm install PhotoToolsFrontend "C:\Program Files\nodejs\node.exe" "S:\...\photo-tools\frontend\node_modules\next\dist\bin\next" "start -p 3000"
nssm set PhotoToolsFrontend AppDirectory "S:\...\photo-tools\frontend"
nssm start PhotoToolsBackend
nssm start PhotoToolsFrontend
```

## 3. Setup A — IIS reverse proxy (Windows Server, no extra software)

1. Install the **URL Rewrite** and **Application Request Routing (ARR)** IIS
   extensions.
2. Create a site bound to your host name; put a placeholder index file in its
   physical path.
3. Enable proxy mode in IIS → server node → Application Request Routing Cache →
   Server Proxy Settings → enable.
4. Add URL Rewrite rules to `web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Frontend" stopProcessing="true">
          <match url="^(.*)$" />
          <conditions>
            <add input="{REQUEST_URI}" pattern="^/api/backend" negate="true" />
          </conditions>
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
        <rule name="Backend direct (optional)" stopProcessing="true">
          <match url="^api/backend/(.*)$" />
          <action type="Rewrite" url="http://127.0.0.1:3000/api/backend/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

5. Add the HTTPS certificate and bind 443. Browsers talk only to IIS; the
   frontend's BFF proxy (not the backend) is what the browser can reach.

## 4. Setup B — Nginx reverse proxy

```nginx
server {
    listen 443 ssl;
    server_name photos.example.com;
    # ssl_certificate / ssl_certificate_key ...

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Note: the browser only ever calls the frontend (which proxies `/api/backend/...`
to the backend internally). Direct backend access from the internet should be
blocked.

## 5. Production upgrades (Redis + PostgreSQL)

The local fallbacks (in-process queue + SQLite) are fine for a single node with
modest load. For horizontal scaling:

1. Run PostgreSQL and Redis (any supported method).
2. Set in `photo-tools/.env`:

```
DATABASE_URL=postgres://user:pass@db-host:5432/photo_tools
REDIS_URL=redis://redis-host:6379
```

3. Restart the backend. On boot it detects the providers and logs:
   `queue=redis` / `store=postgres`. The schema is created automatically.
4. Run as many backend instances as needed behind the reverse proxy; the
   frontend can point `BACKEND_URL` at a load balancer.

## 6. Updating the processing engines

The engines are PyInstaller one-file builds from `bin-src/`:

```powershell
cd bin-src
pyinstaller --onefile --console --name PhotoResizer photo_resizer_cli.py
pyinstaller --onefile --console --name PhotoConverter photo_converter_cli.py
```

Replace the files in `bin/` and restart the backend service. The backend
validates the EXE paths on boot and refuses to start if a configured engine is
missing.

## Troubleshooting

- **Backend won't start** — check the two EXE paths in `.env`; run
  `node dist/index.js` in a console to see the validation error.
- **Uploads return 413** — raise `MAX_FILE_SIZE_MB` and `client_max_body_size`.
- **429 on uploads** — raise `RATE_LIMIT_MAX_REQUESTS`.
- **Images fail to process** — engines log to each job's `logs/` directory under
  `TEMP_DIRECTORY/job-<id>/`.
- **Job files accumulate** — `JOB_RETENTION_MINUTES` / `CLEANUP_INTERVAL_MINUTES`
  control automatic sweeping of files and records.
