# WikiTok

A TikTok-style interface for exploring random Wikipedia articles in multiple languages.

## Features

- Vertical feed of Wikipedia articles, including random, popular, on-this-day, and topic lanes
- Support for 48 languages and Chinese, Wu, Gan, and Cantonese variants
- Article previews with images, titles, and excerpts
- In-app reader with contents, gallery, related pages, and other languages
- Share links that reopen the same article in WikiTok
- Search, likes with collections and import/export, and a recently viewed list
- Language selector with search, matched to the browser on the first visit
- Preloading of images and content for smooth scrolling
- Responsive design that works on mobile and desktop
- Progressive Web App (PWA) support, including an offline shell and an update prompt

## Tech Stack

- React 19
- TypeScript 7 (`tsc`) with the TypeScript 6 API kept for ESLint, which does not understand TypeScript 7 yet
- Tailwind CSS 4
- Vite 8
- Bun 1.4 static server for production headers and rate limits

## Development

Run the commands below in the `/frontend` folder.

1. Install dependencies:

```bash
bun install
```

2. Run development server:

```bash
bun run dev
```

`bun run dev` is the Vite app. Wikipedia is called from the browser.

Production uses `frontend/server.ts`. That process serves the built files, adds the content security policy (including Wikipedia audio and video), rate-limits clients, and writes access logs. Public IP addresses are stored with the last segment removed. City lookups use `geoip-lite`. Refresh that database with `bun run update-geoip` in `/frontend` when you have a MaxMind license key, or pass `MAXMIND_LICENSE_KEY` to the Docker build.

## Deployment

### Docker Compose (Recommended)

1. (Optional) Customize the exposed host port by creating a `.env` file from the example:

```bash
cp .env.example .env
# Edit PORT in .env if desired (defaults to 3000)
```

2. Build and start the container:

```bash
docker compose up -d --build
```

The application will be accessible at `http://localhost:3000` (or your configured `PORT`).

3. Management commands:

```bash
# View container logs
docker compose logs -f

# Check container health status
docker compose ps

# Stop the container
docker compose down
```

### Standalone Docker

You can also build and run the Docker container directly:

```bash
docker build -t wikitok .
docker run -d --name wikitok -p 3000:3000 --restart unless-stopped wikitok
```

### Upstream Reverse Proxy (NGINX)

Use [`nginx.conf.example`](nginx.conf.example) on the reverse proxy. It redirects HTTP to HTTPS, enables HTTP/2, rate limits, and sets the browser security headers. Point `proxy_pass` at the app on port 3000 and keep `X-Forwarded-For` so the app can rate-limit the real client. Set `TRUST_PROXY` to the proxy's address (see `.env.example`).

> [!IMPORTANT]
> - **HTTPS is required for PWA**: Modern browsers will only register Service Workers (`sw.js`) and enable offline PWA features over a secure HTTPS connection.
> - **Firewall Protection**: In a production environment with public IP addresses, configure your firewall (UFW, AWS Security Group, Hetzner Firewall, etc.) to allow incoming connections on port `3000` **only** from your NGINX reverse proxy's IP address. Alternatively, bind to a private network IP in `.env` (`BIND_IP=10.x.x.x`).

## Demo

Check it out here at [wikitok.vercel.app](https://wikitok.vercel.app) or [wikitok.io](https://www.wikitok.io)

**Note:** This is the original WikiTok web project, not affiliated with wikitok.net or the independently developed WikiTok mobile apps for iPhone and Android.

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes and commit them

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Star History

![Star History Chart](https://api.star-history.com/svg?repos=IsaacGemal/wikitok&type=Date)