# WikiTok

A TikTok-style interface for exploring random Wikipedia articles in multiple languages.

## Features

- Vertical scrolling feed of random Wikipedia articles
- Support for 14 languages including English, Spanish, French, German, Chinese, Japanese and more
- Article previews with images, titles and excerpts
- Share articles directly or copy links
- Language selector with country flags
- Preloading of images and content for smooth scrolling
- Responsive design that works on mobile and desktop
- Progressive Web App (PWA) support for installing as a standalone app

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite

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

No backend required!

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

If you are running an external NGINX reverse proxy on a separate server, use this production-ready configuration. It includes HTTPS redirection, HTTP/2, Gzip compression (shrinking bundle transfers by ~70%), rate limiting, security headers, and WebSocket support:

```nginx
# Rate limiting zone (place inside http {} block or before the server blocks)
limit_req_zone $binary_remote_addr zone=wikitok_limit:10m rate=30r/s;

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name wikitok.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Production HTTPS server
server {
    listen 443 ssl http2;
    server_name wikitok.yourdomain.com;

    # SSL certificates (e.g. Let's Encrypt / Certbot)
    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # TLS protocols and ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Gzip compression for static assets
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        limit_req zone=wikitok_limit burst=50 nodelay;

        proxy_pass http://<APP_SERVER_IP>:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded client headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts and buffer tuning
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
        proxy_buffering on;
    }
}
```

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