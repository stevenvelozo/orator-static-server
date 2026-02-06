# Subdomain Folder Routing

Orator's static file serving includes a built-in feature for subdomain-based folder routing. This enables a simple multi-tenant static hosting setup without any additional configuration or infrastructure.

## How It Works

When a request arrives, Orator inspects the `Host` header for subdomain prefixes. If the host has more than one segment (e.g., `clienta.example.com` vs just `localhost`), Orator takes the first segment and checks if a matching subfolder exists in the serve directory.

```
Request: http://clienta.example.com/page.html
Host header: clienta.example.com
    ↓
Split host: ["clienta", "example", "com"]
First segment: "clienta"
    ↓
Check: does ./sites/clienta/ exist?
    ├── Yes → Serve from ./sites/clienta/page.html
    └── No  → Serve from ./sites/page.html
```

## Setup

```javascript
// Serve from ./sites, with subdomain-based subfolder routing
_Fable.Orator.addStaticRoute('./sites/');
```

## Directory Structure

```
sites/
├── index.html           ← Served for requests without subdomain match
├── styles.css
├── clienta/
│   ├── index.html       ← Served for clienta.example.com
│   └── styles.css
├── clientb/
│   ├── index.html       ← Served for clientb.example.com
│   └── styles.css
└── shared/
    └── logo.png
```

## Example Requests

| Request URL | Served File |
|------------|-------------|
| `http://example.com/index.html` | `./sites/index.html` |
| `http://clienta.example.com/index.html` | `./sites/clienta/index.html` |
| `http://clientb.example.com/styles.css` | `./sites/clientb/styles.css` |
| `http://unknown.example.com/page.html` | `./sites/page.html` (no match, falls back) |

## Limitations

- Subdomain routing is one level deep -- it only checks the first subdomain segment
- The subfolder must exist on disk for the routing to activate
- Requests to `localhost` or IP addresses won't trigger subdomain routing (only one host segment)

## Use Cases

- **Multi-tenant SaaS frontends** - Each customer gets a branded subdomain serving their customized UI
- **Development environments** - Different feature branches served from subdomains
- **A/B testing** - Serve different static builds based on subdomain
