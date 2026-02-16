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

					// When the URL is a directory (e.g. '/' or '/docs/'), use the default file for MIME detection
					// so the browser gets text/html instead of application/octet-stream
					let tmpMimeTarget = pRequest.url;
					if (tmpMimeTarget.endsWith('/') || tmpMimeTarget.indexOf('.') < 0)
					{
						tmpMimeTarget = tmpDefaultFile;
					}
					this.setMimeHeader(tmpMimeTarget, pResponse);

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
}

module.exports = OratorStaticServer;
