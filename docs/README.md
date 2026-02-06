# Orator Static Server

> Static file serving for Orator API servers

Orator Static Server provides static file serving capabilities for Orator-based applications. The core functionality lives in the main `orator` module's `addStaticRoute` method -- this documentation covers how to use it effectively for development servers, single page applications, and multi-tenant hosting.

## Features

- **File Serving** - Serve static files from any directory on disk
- **MIME Detection** - Automatic Content-Type headers based on file extension
- **Default Files** - Configurable default file (e.g., `index.html`) for directory requests
- **Route Stripping** - Strip URL prefixes before mapping to the filesystem
- **Subdomain Routing** - Serve different folders based on request subdomain

## Quick Start

```javascript
const libFable = require('fable');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');

const _Fable = new libFable({
	Product: 'MyStaticServer',
	ServicePort: 8080
});

_Fable.serviceManager.addServiceType('Orator', libOrator);
_Fable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);
_Fable.serviceManager.instantiateServiceProvider('Orator');
_Fable.serviceManager.instantiateServiceProvider('OratorServiceServer');

_Fable.Orator.addStaticRoute('./public/');
_Fable.Orator.startService();
```

## How It Works

When `addStaticRoute` is called, Orator registers a GET route handler on the service server that:

1. Checks for subdomain-based folder routing
2. Strips the configured URL prefix from the request path
3. Sets the appropriate MIME type Content-Type header
4. Serves the file from disk using `serve-static`

## Related Packages

- [orator](https://github.com/stevenvelozo/orator) - Main Orator service (includes addStaticRoute)
- [orator-serviceserver-restify](https://github.com/stevenvelozo/orator-serviceserver-restify) - Restify service server
- [fable](https://github.com/stevenvelozo/fable) - Service provider framework
