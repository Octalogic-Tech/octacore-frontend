# Deploying the frontend on Railway

The repo-root `Dockerfile` builds `apps/core` with Nx and serves the static files with nginx. Railway detects the Dockerfile on its own.

## Build variable: `VITE_CORE_API_URL`

- It is read at **build** time: Vite writes it into the JavaScript. Set it as a service variable on Railway (it reaches the build because the Dockerfile declares it as an `ARG`). Changing it needs a **rebuild** (redeploy); restarting is not enough.
- Value: the API's public base URL including the path, for example `https://api.example.com/api/v1`.
- The build fails if it is empty, so a missing variable cannot ship an app that points at `localhost`.
- It ends up in public JavaScript. **Never put a secret in a `VITE_*` variable**; this service has no secrets.

## Runtime

- nginx listens on `$PORT`. Railway sets it; the default is `8080`, so you do not need to set it.
- Single-page app fallback: any path that is not a file (`/users`, `/resources/people`) returns `index.html`, so deep links and reloads work. A missing file under `/assets/` returns 404.
- Caching: files in `/assets/` are hashed and cached for a year (`immutable`); `index.html` is `no-cache`, so a new deploy is picked up on the next load.

## Cookies: one site for the app and the API

The backend's refresh cookie is `SameSite=Lax`, so the browser sends it on API calls only when the app and the API are on the **same site**. Two default Railway domains (`<app>.up.railway.app` and `<api>.up.railway.app`) are different sites, and sign-in would be lost on every reload.

Use two subdomains of one company domain, for example `app.example.com` (this service) and `api.example.com` (the backend), and set on the backend `CORS_ORIGINS=https://app.example.com` and `COOKIE_SECURE=true` (see the backend's deploy notes).

## Try the image locally

```bash
docker build --build-arg VITE_CORE_API_URL=http://localhost:5001/api/v1 -t octacore-frontend .
docker run --rm -p 8080:8080 octacore-frontend           # http://localhost:8080
docker run --rm -e PORT=9090 -p 9090:9090 octacore-frontend
```
