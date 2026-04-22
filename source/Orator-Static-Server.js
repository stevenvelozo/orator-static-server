/**
* Orator Static Server
*
* Static file serving for Orator API servers.  Handles MIME type detection,
* route stripping, default files, magic subdomain folder mapping, and
* Content-Type headers so browsers render HTML instead of downloading it.
*
* @license MIT
*
* @author Steven Velozo <steven@velozo.com>
*/

const libFableServiceProviderBase = require('fable-serviceproviderbase');

const libServeStatic = require('serve-static');
const libFinalHandler = require('finalhandler');
const libMime = require('mime');

/**
 * @class OratorStaticServer
 * @extends libFableServiceProviderBase
 *
 * A service provider that manages static file serving routes on an Orator instance.
 */
class OratorStaticServer extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'OratorStaticServer';

		// Keep track of registered static routes for introspection
		this.routes = [];

		// This is here because libMime has a breaking change from v1 to v2 and the lookup function was update to be getType per https://stackoverflow.com/a/60741078
		// We don't want to introspect properties on this library every single time we need to check mime types.
		// Therefore we are setting this boolean here and using it to branch.
		this.oldLibMime = false;
		if ('lookup' in libMime)
		{
			this.oldLibMime = true;
		}
	}

	/**
	 * Set the Content-Type header on a response based on the file name.
	 *
	 * @param {string} pFileName - The file name (or path) to detect MIME type from.
	 * @param {Object} pResponse - The HTTP response object.
	 */
	setMimeHeader(pFileName, pResponse)
	{
		let tmpHeader;

		if (this.oldLibMime)
		{
			tmpHeader = libMime.lookup(pFileName);
		}
		else
		{
			tmpHeader = libMime.getType(pFileName);
		}

		if (!tmpHeader)
		{
			tmpHeader = 'application/octet-stream';
		}

		pResponse.setHeader('Content-Type', tmpHeader);
	}

	/**
	 * Add a static file serving route to the Orator instance.
	 *
	 * @param {string} pFilePath - The path on disk to serve files from.
	 * @param {string} [pDefaultFile='index.html'] - The default file for directory requests.
	 * @param {string} [pRoute='/*'] - The route pattern to match.
	 * @param {string} [pRouteStrip='/'] - URL prefix to strip before filesystem lookup.
	 * @param {object} [pParams={}] - Additional parameters passed to serve-static.
	 * @returns {boolean} true if the route was successfully installed.
	 */
	addStaticRoute(pFilePath, pDefaultFile, pRoute, pRouteStrip, pParams)
	{
		if (!this.fable.Orator)
		{
			this.log.error('OratorStaticServer requires an Orator instance to be registered with Fable.');
			return false;
		}

		if (typeof(pFilePath) !== 'string')
		{
			this.fable.log.error('A file path must be passed in as part of the server.');
			return false;
		}

		// Default to just serving from root
		const tmpRoute = (typeof(pRoute) === 'undefined') ? '/*' : pRoute;
		const tmpRouteStrip = (typeof(pRouteStrip) === 'undefined') ? '/' : pRouteStrip;

		// Default to serving index.html
		const tmpDefaultFile = (typeof(pDefaultFile) === 'undefined') ? 'index.html' : pDefaultFile;

		let tmpOrator = this.fable.Orator;

		this.fable.log.info('Orator mapping static route to files: '+tmpRoute+' ==> '+pFilePath+' '+tmpDefaultFile);

		// Ensure FilePersistence is available for the magic subdomain subfolder check
		if (!this.fable.FilePersistence)
		{
			this.fable.serviceManager.instantiateServiceProvider('FilePersistence');
		}

		// Try the service server's built-in serveStatic first (e.g. restify's serveStaticFiles plugin).
		// This handles MIME types, caching headers, and streaming correctly without our manual intervention.
		if (typeof(tmpOrator.serviceServer.serveStatic) === 'function')
		{
			let tmpServeStaticOptions = Object.assign({ directory: pFilePath, default: tmpDefaultFile }, pParams);
			if (tmpOrator.serviceServer.serveStatic(tmpRoute, tmpServeStaticOptions))
			{
				this.routes.push(
					{
						filePath: pFilePath,
						defaultFile: tmpDefaultFile,
						route: tmpRoute,
						routeStrip: tmpRouteStrip,
						params: pParams || {}
					});
				return true;
			}
		}

		// Fall back to the serve-static library approach (used by the IPC service server and other
		// service servers that don't have a built-in serveStatic implementation).
		tmpOrator.serviceServer.get(tmpRoute,
			(pRequest, pResponse, fNext) =>
			{
					// See if there is a magic subdomain put at the beginning of a request.
					// If there is, then we need to see if there is a subfolder and add that to the file path
					let tmpHostSet = pRequest.headers.host.split('.');
					let tmpPotentialSubfolderMagicHost = false;
					let servePath = pFilePath;
					// Check if there are more than one host in the host header (this will be 127 a lot)
					if (tmpHostSet.length > 1)
					{
						tmpPotentialSubfolderMagicHost = tmpHostSet[0];
					}
					if (tmpPotentialSubfolderMagicHost)
					{
						// Check if the subfolder exists -- this is only one dimensional for now
						let tmpPotentialSubfolder = servePath + tmpPotentialSubfolderMagicHost;
						if (this.fable.FilePersistence.libFS.existsSync(tmpPotentialSubfolder))
						{
							// If it does, then we need to add it to the file path
							servePath = `${tmpPotentialSubfolder}/`;
						}
					}
					pRequest.url = pRequest.url.split('?')[0].substr(tmpRouteStrip.length) || '/';
					pRequest.path = function()
					{
							return pRequest.url;
					};

					// Let serve-static handle Content-Type detection.  It resolves
					// the actual file path first (e.g. / → /index.html) and then
					// sets the correct MIME type with charset.  Pre-setting the
					// header here would prevent serve-static from overriding it
					// because the underlying `send` library skips Content-Type
					// when the header is already present.
					const tmpServe = libServeStatic(servePath, Object.assign({ index: tmpDefaultFile }, pParams));
					tmpServe(pRequest, pResponse, libFinalHandler(pRequest, pResponse));
					// TODO: This may break things if a post request send handler is setup...
					//fNext();
			});

		this.routes.push(
			{
				filePath: pFilePath,
				defaultFile: tmpDefaultFile,
				route: tmpRoute,
				routeStrip: tmpRouteStrip,
				params: pParams || {}
			});
		return true;
	}

	/**
	 * Like addStaticRoute, but any file listed in pFallbackMap that isn't
	 * present on disk produces a 302 redirect to the mapped URL instead of
	 * a 404. Useful for offering CDN fallbacks on runtime assets that are
	 * optionally committed alongside the build output.
	 *
	 *   addStaticRouteWithFallbacks(
	 *     './web-application/', null, '/pict/*', '/pict/', null,
	 *     { 'pict.min.js': 'https://unpkg.com/pict/dist/pict.min.js' });
	 *
	 * Files present locally are served normally (MIME types, caching, etc.
	 * all via serve-static). Files absent locally that ARE in the map are
	 * redirected. Files absent locally that are NOT in the map 404 as usual.
	 *
	 * This variant does not use the service server's built-in serveStatic
	 * plugin (e.g. restify.plugins.serveStatic) because that plugin does
	 * not expose a "not found" hook; it always finalises the response.
	 *
	 * @param {string} pFilePath - The path on disk to serve files from.
	 * @param {string} [pDefaultFile='index.html'] - The default file for directory requests.
	 * @param {string} [pRoute='/*'] - The route pattern to match.
	 * @param {string} [pRouteStrip='/'] - URL prefix to strip before filesystem lookup.
	 * @param {object} [pParams={}] - Additional parameters passed to serve-static.
	 * @param {Object<string,string>} [pFallbackMap={}] - Map of relative-path (under the route prefix) to absolute URL.
	 * @returns {boolean} true if the route was successfully installed.
	 */
	addStaticRouteWithFallbacks(pFilePath, pDefaultFile, pRoute, pRouteStrip, pParams, pFallbackMap)
	{
		if (!this.fable.Orator)
		{
			this.log.error('OratorStaticServer requires an Orator instance to be registered with Fable.');
			return false;
		}
		if (typeof(pFilePath) !== 'string')
		{
			this.fable.log.error('A file path must be passed in as part of the server.');
			return false;
		}

		const tmpRoute = (typeof(pRoute) === 'undefined') ? '/*' : pRoute;
		const tmpRouteStrip = (typeof(pRouteStrip) === 'undefined') ? '/' : pRouteStrip;
		const tmpDefaultFile = (typeof(pDefaultFile) === 'undefined') ? 'index.html' : pDefaultFile;
		const tmpFallbackMap = pFallbackMap || {};

		let tmpOrator = this.fable.Orator;

		this.fable.log.info('Orator mapping static+fallback route to files: '
			+ tmpRoute + ' ==> ' + pFilePath + ' ' + tmpDefaultFile
			+ ' (fallback entries: ' + Object.keys(tmpFallbackMap).length + ')');

		if (!this.fable.FilePersistence)
		{
			this.fable.serviceManager.instantiateServiceProvider('FilePersistence');
		}

		tmpOrator.serviceServer.get(tmpRoute,
			(pRequest, pResponse, fNext) =>
			{
					// Capture the relative path BEFORE the URL rewrite so we can
					// look it up in the fallback map on a miss.
					let tmpRelative = (pRequest.url || '').split('?')[0];
					if (tmpRelative.indexOf(tmpRouteStrip) === 0)
					{
						tmpRelative = tmpRelative.slice(tmpRouteStrip.length);
					}
					try { tmpRelative = decodeURIComponent(tmpRelative); }
					catch (pError) { /* non-fatal; will fall through to 404 */ }

					// Magic subdomain subfolder check (mirrors addStaticRoute)
					let tmpHostSet = pRequest.headers.host.split('.');
					let tmpPotentialSubfolderMagicHost = false;
					let servePath = pFilePath;
					if (tmpHostSet.length > 1)
					{
						tmpPotentialSubfolderMagicHost = tmpHostSet[0];
					}
					if (tmpPotentialSubfolderMagicHost)
					{
						let tmpPotentialSubfolder = servePath + tmpPotentialSubfolderMagicHost;
						if (this.fable.FilePersistence.libFS.existsSync(tmpPotentialSubfolder))
						{
							servePath = `${tmpPotentialSubfolder}/`;
						}
					}

					pRequest.url = pRequest.url.split('?')[0].substr(tmpRouteStrip.length) || '/';
					pRequest.path = function() { return pRequest.url; };

					const tmpServe = libServeStatic(servePath, Object.assign({ index: tmpDefaultFile }, pParams));
					tmpServe(pRequest, pResponse,
						(pError) =>
						{
							// serve-static invokes this when it cannot serve a local
							// file (missing, method not allowed, etc.). We get a
							// chance to redirect before the default final handler
							// would otherwise 404.
							if (!pError && Object.prototype.hasOwnProperty.call(tmpFallbackMap, tmpRelative))
							{
								let tmpTarget = tmpFallbackMap[tmpRelative];
								pResponse.statusCode = 302;
								pResponse.setHeader('Location', tmpTarget);
								pResponse.setHeader('Content-Type', 'text/plain; charset=utf-8');
								pResponse.end('Redirecting to ' + tmpTarget + '\n');
								return;
							}
							return libFinalHandler(pRequest, pResponse)(pError);
						});
			});

		this.routes.push(
			{
				filePath: pFilePath,
				defaultFile: tmpDefaultFile,
				route: tmpRoute,
				routeStrip: tmpRouteStrip,
				params: pParams || {},
				fallbackMap: tmpFallbackMap,
			});
		return true;
	}
}

module.exports = OratorStaticServer;
